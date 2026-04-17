import logging
from flask import Blueprint, request, jsonify
from models.user import User
import jwt
import datetime
from config import Config
from werkzeug.security import generate_password_hash
from utils.db import get_db

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()
    required_role = data.get('required_role') # 'admin' or 'lgu' from web dashboard

    logger.info("Login attempt: user=%s req_role=%s", username, required_role)

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = User.find_by_username(username)

    if not user:
        logger.warning("Login failed - user not found: %s", username)
    else:
        logger.debug("Found user: %s role=%s", user.username, user.role)

    if user and user.check_password(password):
        # --- Strict Role Validation ---
        if required_role == 'admin':
            if user.role != 'super_admin':
                 return jsonify({"error": "Unauthorized: Admin access required."}), 403
        elif required_role == 'lgu':
            if user.role != 'lgu_admin':
                 return jsonify({"error": "Unauthorized: LGU Moderator access required."}), 403
        elif not required_role:
             # Default mobile app behavior (usually allow 'user')
             if user.role not in ['user', 'lgu_admin', 'super_admin']:
                  return jsonify({"error": "Unauthorized account."}), 403
        # -------------------------------
        
        token = jwt.encode({
            'user_id': user.id,
            'role': user.role,
            'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, Config.SECRET_KEY, algorithm="HS256")
        
        # Check if user needs to change password
        # We need to fetch the flag. User model might need update or we just check DB here.
        # Ideally update User model. But for quick implementation, let's query raw or update User model.
        # User.find_by_username returns a User object. Let's see if we can get the flag from it.
        # The User class in user.py needs to accept this new field.
        
        # Let's re-query to get the flag or update User model.
        # Updating User model is cleaner.
        
        # Fetch status directly for now to avoid Model refactor in this step if possible, 
        # but let's assume we will update User model next.
        # Let's return the flag in the response.
        
        must_change = False
        try:
             db = get_db()
             cursor = db.cursor()
             cursor.execute("SELECT must_change_password FROM users WHERE id = %s", (user.id,))
             result = cursor.fetchone()
             if result:
                 must_change = bool(result[0])
             cursor.close()
        except Exception as e:
             logger.warning("Could not fetch must_change_password for user %s: %s", user.id, e)

        return jsonify({
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
                "must_change_password": must_change,
                "full_name": user.full_name,
                "barangay": user.barangay
            }
        }), 200
    
    return jsonify({"error": "Invalid credentials"}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    full_name = data.get('full_name')
    email = data.get('email')
    phone = data.get('phone')
    barangay = data.get('barangay')
    
    if not full_name or not email or not phone:
        return jsonify({"error": "Full name, email, and phone are required"}), 400
        
    # Generate easier default password: "FloodGuard" + 4 random digits
    import secrets
    random_digits = ''.join(secrets.choice("0123456789") for i in range(4))
    generated_password = "FloodGuard" + random_digits
    password_hash = generate_password_hash(generated_password)
    
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Check if email already exists
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close()
        return jsonify({"error": "Email already registered"}), 409
        
    try:
        # Insert with must_change_password = 1 (True)
        cursor.execute("""
            INSERT INTO users (full_name, email, phone, barangay, password, must_change_password, role)
            VALUES (%s, %s, %s, %s, %s, %s, 'user')
        """, (full_name, email, phone, barangay, password_hash, 1))
        db.commit()
        user_id = cursor.lastrowid
        cursor.close()
        
        # Send credentials via email (new refactored service)
        from utils.email_service import send_credentials_email
        success, email_response = send_credentials_email(email, full_name, generated_password)
        
        if success:
            return jsonify({
                "message": "Account created! Please check your email for credentials.",
                "user_id": user_id
            }), 201
        else:
            # More descriptive error message for the mobile user
            return jsonify({
                "message": f"Account created, but credentials email failed: {email_response}",
                "user_id": user_id,
                "error": email_response
            }), 201
            
    except Exception as e:
        cursor.close()
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/change-password', methods=['POST'])
def change_password():
    data = request.get_json()
    user_id = data.get('user_id')
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not user_id or not current_password or not new_password:
        return jsonify({"error": "Missing required fields"}), 400
        
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Verify current password
        cursor.execute("SELECT password FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            return jsonify({"error": "User not found"}), 404
            
        if not check_password_hash(user_row['password'], current_password):
            return jsonify({"error": "Incorrect current password"}), 401

        # Proceed to update with new password
        new_hash = generate_password_hash(new_password)
        cursor.execute("""
            UPDATE users 
            SET password = %s, must_change_password = 0 
            WHERE id = %s
        """, (new_hash, user_id))
        db.commit()
        
        return jsonify({"message": "Password updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@auth_bp.route('/logout', methods=['POST'])
def logout():
    # Since we are using stateless JWT, the client simply discards the token.
    # In a more advanced implementation, we would blacklist the token here.
    return jsonify({"message": "Logged out successfully"}), 200
