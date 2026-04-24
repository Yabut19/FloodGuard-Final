from flask import Blueprint, request, jsonify
from utils.db import get_db
from werkzeug.security import generate_password_hash
from utils.email_service import send_credentials_email
from utils.auth_middleware import admin_required, lgu_or_admin_required

admin_bp = Blueprint('admin', __name__)

def _emit_user_update():
    """Broadcast user list change to all WebSocket clients."""
    try:
        from socket_instance import socketio
        socketio.emit("user_update", {"message": "refresh"}, namespace="/")
    except Exception:
        pass

@admin_bp.route('/fix-db', methods=['GET'])
def fix_db():
    try:
        from utils.db import get_db
        db = get_db()
        cursor = db.cursor()
        
        # Repair users table
        cursor.execute("DESCRIBE users")
        u_cols = {row[0] for row in cursor.fetchall()}
        if 'status' not in u_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
        if 'avatar_url' not in u_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL")
            
        # Repair admins table
        cursor.execute("DESCRIBE admins")
        a_cols = {row[0] for row in cursor.fetchall()}
        if 'status' not in a_cols:
            cursor.execute("ALTER TABLE admins ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
        if 'avatar_url' not in a_cols:
            cursor.execute("ALTER TABLE admins ADD COLUMN avatar_url VARCHAR(255) DEFAULT NULL")
        if 'full_name' not in a_cols:
            cursor.execute("ALTER TABLE admins ADD COLUMN full_name VARCHAR(100) DEFAULT NULL")
        if 'created_at' not in a_cols:
            cursor.execute("ALTER TABLE admins ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            
        db.commit()
        cursor.close()
        return jsonify({"message": "Database schema repaired successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/create-user', methods=['POST'])
@admin_required
def create_user(current_user):
    data = request.get_json()
    full_name = data.get('full_name')
    email = data.get('email')
    phone = data.get('phone') or ""
    barangay = data.get('barangay') or ""
    password = data.get('password')
    role = data.get('role', 'lgu_admin') # Default for safety

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Received create-user request for {email} as {role}")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    db = get_db()
    cursor = db.cursor(dictionary=True)
    
    # Check if exists in any table
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        cursor.close()
        return jsonify({"error": "Email already exists in mobile users"}), 409
        
    cursor.execute("SELECT id FROM admins WHERE username = %s", (email,))
    if cursor.fetchone():
        cursor.close()
        return jsonify({"error": "Username/Email already exists in admins"}), 409
        
    try:
        password_hash = generate_password_hash(password)
        
        if role in ['super_admin', 'admin']:
            # Insert into admins table (username, password, role, full_name)
            cursor.execute("""
                INSERT INTO admins (username, password, role, full_name)
                VALUES (%s, %s, %s, %s)
            """, (email, password_hash, role, full_name))
        else:
            # Insert into users table (full_name, email, role, etc)
            cursor.execute("""
                INSERT INTO users (full_name, email, phone, barangay, password, role, must_change_password)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (full_name, email, phone, barangay, password_hash, role, 1))

        db.commit()
        user_id = cursor.lastrowid
        cursor.close()
        
        # Send credentials email in a background thread
        import threading

        def _send_bg():
            # Send email for all roles including super_admin and admin
            is_admin_flag = role in ['lgu_admin', 'lgu', 'super_admin', 'admin']
            ok, msg = send_credentials_email(email, full_name or email, password, is_admin=is_admin_flag)
            level = logger.info if ok else logger.warning
            level("[create-user] Email to %s: %s", email, msg)

        threading.Thread(target=_send_bg, daemon=True).start()
        
        _emit_user_update()
        
        return jsonify({
            "message": f"Account with role '{role}' created successfully",
            "user_id": user_id,
        }), 201
    except Exception as e:
        cursor.close()
        return jsonify({"error": str(e)}), 500


@admin_bp.route('/users', methods=['GET'])
@lgu_or_admin_required
def get_users(current_user):
    try:
        from models.user import User
        users = User.get_all_users()
        
        # 1. Total users is the combined list
        total_users = len(users)
        
        # 2. Count active users (defaulting to active if status is None)
        active_users = sum(1 for u in users if (u.get('status') or 'active').lower() == 'active')
        
        # 3. Count moderators (including 'lgu_admin' and 'lgu')
        lgu_moderators = sum(1 for u in users if u.get('role') in ['lgu_admin', 'lgu'])
        
        # 4. Count super admins (including 'super_admin' and 'admin')
        super_admins = sum(1 for u in users if u.get('role') in ['super_admin', 'admin'])
        
        # We can also count specific user roles if needed
        regular_users = sum(1 for u in users if u['role'] == 'user')
        
        return jsonify({
            "users": users,
            "stats": {
                "total_users": total_users,
                "active_users": active_users,
                "lgu_moderators": lgu_moderators,
                "super_admins": super_admins,
                "regular_users": regular_users
            }
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_bp.route('/users/<string:user_id>', methods=['DELETE'])
@admin_required
def delete_user(current_user, user_id):
    db = get_db()
    cursor = db.cursor()
    try:
        if user_id.startswith('u-'):
            table = 'users'
            db_id = user_id[2:]
        elif user_id.startswith('a-'):
            table = 'admins'
            db_id = user_id[2:]
            
            # Prevent self-deletion
            if str(db_id) == str(current_user.get('user_id')):
                return jsonify({"error": "You cannot delete your own account"}), 403
        else:
            return jsonify({"error": "Invalid user ID format"}), 400

        cursor.execute(f"DELETE FROM {table} WHERE id = %s", (db_id,))
        db.commit()
        _emit_user_update()
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@admin_bp.route('/locations', methods=['GET'])
@lgu_or_admin_required
def get_locations(current_user):
    """Fetch all unique locations from sensors and combine with default sitios."""
    db = get_db()
    cursor = db.cursor()
    try:
        # Get unique barangays from registered sensors
        cursor.execute("SELECT DISTINCT barangay FROM sensors WHERE barangay IS NOT NULL AND barangay != ''")
        sensor_locations = [row[0] for row in cursor.fetchall()]
        
        # Standard default sitios for Mabolo
        default_sitios = [
            "Almendras", "Banilad (Mabolo)", "Cabantan", "Casals Village",
            "Castle Peak", "Holy Name", "M.J. Cuenco", "Panagdait",
            "San Isidro", "San Roque", "San Vicente", "Santo Niño",
            "Sindulan", "Soriano", "Tres Borces"
        ]
        
        # Combine, unique, and sort
        all_locations = sorted(list(set(sensor_locations + default_sitios)))
        
        return jsonify(all_locations), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@admin_bp.route('/users/<string:user_id>', methods=['PUT'])
@lgu_or_admin_required
def update_user_details(current_user, user_id):
    data = request.get_json()
    full_name = data.get('full_name')
    barangay = data.get('barangay')
    password = data.get('password')
    
    db = get_db()
    cursor = db.cursor()
    try:
        if user_id.startswith('u-'):
            db_id = user_id[2:]
            cursor.execute("UPDATE users SET full_name = %s, barangay = %s WHERE id = %s", (full_name, barangay, db_id))
            
            # Allow password change for LGUs only
            if password:
                cursor.execute("SELECT role FROM users WHERE id = %s", (db_id,))
                user_role = cursor.fetchone()
                if user_role and user_role[0] in ['lgu_admin', 'lgu']:
                    from werkzeug.security import generate_password_hash
                    cursor.execute("UPDATE users SET password = %s WHERE id = %s", (generate_password_hash(password), db_id))
        elif user_id.startswith('a-'):
            db_id = user_id[2:]
            # admins table usually doesn't have barangay
            cursor.execute("UPDATE admins SET full_name = %s WHERE id = %s", (full_name, db_id))
        else:
            return jsonify({"error": "Invalid user ID format"}), 400
            
        db.commit()
        _emit_user_update()
        return jsonify({"message": "User details updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@admin_bp.route('/users/<string:user_id>/status', methods=['PUT'])
@lgu_or_admin_required
def update_user_status(current_user, user_id):
    data = request.get_json()
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({"error": "Status is required"}), 400

    db = get_db()
    cursor = db.cursor()
    try:
        if user_id.startswith('u-'):
            table = 'users'
            db_id = user_id[2:]
        elif user_id.startswith('a-'):
            table = 'admins'
            db_id = user_id[2:]
        else:
             return jsonify({"error": "Invalid user ID format"}), 400

        cursor.execute(f"UPDATE {table} SET status = %s WHERE id = %s", (new_status, db_id))
        db.commit()
        _emit_user_update()
        return jsonify({"message": "Status updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()

@admin_bp.route('/users/<string:user_id>/role', methods=['PUT'])
@admin_required
def update_user_role(current_user, user_id):
    data = request.get_json()
    new_role = data.get('role')
    
    if not new_role:
        return jsonify({"error": "Role is required"}), 400

    db = get_db()
    cursor = db.cursor()
    try:
        if user_id.startswith('u-'):
            table = 'users'
            db_id = user_id[2:]
        elif user_id.startswith('a-'):
            table = 'admins'
            db_id = user_id[2:]
        else:
            return jsonify({"error": "Invalid user ID format"}), 400

        # valid roles: 'user', 'lgu_admin', 'super_admin', 'admin'
        if new_role in ['user', 'lgu_admin', 'super_admin', 'admin']:
            cursor.execute(f"UPDATE {table} SET role = %s WHERE id = %s", (new_role, db_id))
            db.commit()
            _emit_user_update()
            return jsonify({"message": "Role updated successfully"}), 200
        else:
            return jsonify({"error": "Invalid role specified"}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
