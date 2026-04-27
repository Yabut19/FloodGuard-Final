from flask import Blueprint, request, jsonify, url_for
from utils.db import get_db
import os
from werkzeug.utils import secure_filename
from config import Config

user_bp = Blueprint('user', __name__)

def _emit_user_update():
    """Broadcast user list change to all WebSocket clients."""
    try:
        from app import socketio
        socketio.emit("user_update", {"message": "refresh"})
    except Exception:
        pass

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@user_bp.route('/<int:user_id>', methods=['GET'])
def get_user_profile(user_id):
    user_type = request.args.get('type', 'user') # 'user' or 'admin'
    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    try:
        if user_type == 'admin':
            # Admins table has: id, username, full_name, phone, password, role, created_at, avatar_url
            cursor.execute("SELECT id, username, full_name, phone, role, avatar_url FROM admins WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if user:
                # Map to frontend expected format
                user['email'] = user['username']
                # phone is already in user dict if it exists in schema
                if not user.get('full_name'):
                    user['full_name'] = "Super Admin"
                user['barangay'] = "System"
        else:
            # Fetch user details
            cursor.execute("""
                SELECT id, full_name, email, phone, barangay, avatar_url 
                FROM users 
                WHERE id = %s
            """, (user_id,))
            user = cursor.fetchone()
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        # Add full URL for avatar if it exists
        if user.get('avatar_url'):
            # Path is relative in DB, frontend handles full URL construction usually, 
            # but existing code implies frontend expects just path.
            pass

        return jsonify(user), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@user_bp.route('/<int:user_id>/avatar', methods=['POST'])
def upload_avatar(user_id):
    user_type = request.args.get('type', 'user')
    
    if 'image' not in request.files:
        return jsonify({"error": "No image part"}), 400
        
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    if file and allowed_file(file.filename):
        # Prefix filename with type to avoid collision in storage too if needed, though ID collision handling in DB is key.
        # Let's keep file naming consistent but maybe add type.
        filename = secure_filename(f"{user_type}_{user_id}_{file.filename}")
        
        # Ensure upload directory exists
        upload_folder = os.path.join(os.getcwd(), 'static', 'uploads', 'avatars')
        os.makedirs(upload_folder, exist_ok=True)
        
        file_path = os.path.join(upload_folder, filename)
        file.save(file_path)
        
        # Save relative path to DB
        avatar_url = f"/static/uploads/avatars/{filename}"
        
        db = get_db()
        cursor = db.cursor()
        try:
            if user_type == 'admin':
                cursor.execute("UPDATE admins SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
            else:
                cursor.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (avatar_url, user_id))
            
            db.commit()
            
            _emit_user_update()
            
            return jsonify({
                "message": "Avatar updated successfully",
                "avatar_url": avatar_url
            }), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            cursor.close()
            
    return jsonify({"error": "Invalid file type"}), 400
    
@user_bp.route('/<int:user_id>/avatar', methods=['DELETE'])
def delete_avatar(user_id):
    user_type = request.args.get('type', 'user')
    db = get_db()
    cursor = db.cursor()
    try:
        if user_type == 'admin':
            cursor.execute("UPDATE admins SET avatar_url = NULL WHERE id = %s", (user_id,))
        else:
            cursor.execute("UPDATE users SET avatar_url = NULL WHERE id = %s", (user_id,))
        db.commit()
        _emit_user_update()
        return jsonify({"message": "Avatar removed successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@user_bp.route('/<int:user_id>', methods=['PUT'])
def update_user_profile(user_id):
    user_type = request.args.get('type', 'user')
    data = request.get_json()
    
    full_name = data.get('full_name')
    email = data.get('email')
    phone = data.get('phone')
    
    if not full_name or not email:
        return jsonify({"error": "Name and Email are required"}), 400
        
    db = get_db()
    cursor = db.cursor()
    
    try:
        if user_type == 'admin':
             # Admins table: id, username, role, ...
             # We map 'email' from frontend to 'username' here.
             # Check if username exists for OTHER admins
             # Update username, full_name and phone for admins
             cursor.execute("""
                UPDATE admins 
                SET username = %s, full_name = %s, phone = %s 
                WHERE id = %s
             """, (email, full_name, phone, user_id))
             
        else:
            # Check if email is already taken by another user
            cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (email, user_id))
            if cursor.fetchone():
                return jsonify({"error": "Email is already in use by another account"}), 409
                
            cursor.execute("""
                UPDATE users 
                SET full_name = %s, email = %s, phone = %s 
                WHERE id = %s
            """, (full_name, email, phone, user_id))
        
        db.commit()
        
        _emit_user_update()
        
        return jsonify({"message": "Profile updated successfully"}), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
