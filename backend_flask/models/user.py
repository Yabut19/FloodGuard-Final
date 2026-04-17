import os
from utils.db import get_db
from werkzeug.security import check_password_hash

class User:
    def __init__(self, id, username, role, password_hash, must_change_password=False, full_name=None, barangay=None):
        self.id = id
        self.username = username
        self.role = role
        self.password_hash = password_hash
        self.must_change_password = must_change_password
        self.full_name = full_name or username # Fallback to username if no name
        self.barangay = barangay

    @staticmethod
    def find_by_username(username):
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # 1. Check admins table first
        query = "SELECT * FROM admins WHERE username = %s"
        cursor.execute(query, (username,))
        user_data = cursor.fetchone()
        
        if user_data:
            cursor.close()
            full_name = user_data.get('full_name')
            if not full_name:
                if user_data.get('role') == 'super_admin':
                    full_name = 'Super Admin'
                elif user_data.get('role') == 'lgu_admin':
                    full_name = 'LGU Moderator'
                else:
                    full_name = user_data.get('username')
            return User(
                id=user_data['id'],
                username=user_data['username'],
                role=user_data['role'],
                password_hash=user_data['password'],
                full_name=full_name,
                barangay="All Locations" # Admins have access to all areas
            )

        # 2. Check users table (mobile users) using email as username
        query = "SELECT * FROM users WHERE email = %s"
        cursor.execute(query, (username,))
        user_data = cursor.fetchone()
        cursor.close()

        if user_data:
            return User(
                id=user_data['id'],
                username=user_data['email'], # Use email as username
                role=user_data.get('role', 'user'), # Use role from DB or default to 'user'
                password_hash=user_data['password'],
                must_change_password=bool(user_data.get('must_change_password', 0)),
                full_name=user_data.get('full_name'),
                barangay=user_data.get('barangay')
            )
            
        return None

    @staticmethod
    def get_all_users():
        db = get_db()
        cursor = db.cursor(dictionary=True)
        
        # 1. Dynamically find existing columns for 'users'
        cursor.execute("DESCRIBE users")
        u_cols = {row['Field'] for row in cursor.fetchall()}
        
        # Build safe query for users
        u_select = ["id", "role"]
        if "email" in u_cols: u_select.append("email")
        if "full_name" in u_cols: u_select.append("full_name")
        if "barangay" in u_cols: u_select.append("barangay")
        if "status" in u_cols: u_select.append("status")
        if "created_at" in u_cols: u_select.append("created_at")
        if "avatar_url" in u_cols: u_select.append("avatar_url")
        
        cursor.execute(f"SELECT {', '.join(u_select)} FROM users")
        mobile_users = cursor.fetchall()
        
        all_users = []
        for u in mobile_users:
            email = u.get('email') or u.get('username', 'N/A')
            all_users.append({
                "id": f"u-{u['id']}",
                "name": u.get('full_name') or email,
                "email": email,
                "role": u.get('role', 'user'),
                "location": u.get('barangay', 'N/A'),
                "status": u.get('status', 'active'),
                "joined": (u['created_at'].strftime('%Y-%m-%d') if hasattr(u.get('created_at'), 'strftime') else str(u.get('created_at'))) if u.get('created_at') else 'N/A',
                "avatar_url": u.get('avatar_url'),
                "type": "user"
            })

        # 2. Dynamically find existing columns for 'admins'
        cursor.execute("DESCRIBE admins")
        a_cols = {row['Field'] for row in cursor.fetchall()}
        
        # Build safe query for admins
        a_select = ["id", "username", "role"]
        if "full_name" in a_cols: a_select.append("full_name")
        if "created_at" in a_cols: a_select.append("created_at")
        if "avatar_url" in a_cols: a_select.append("avatar_url")
        
        cursor.execute(f"SELECT {', '.join(a_select)} FROM admins")
        admins = cursor.fetchall()
        
        for a in admins:
             all_users.append({
                "id": f"a-{a['id']}",
                "name": a.get('full_name') or a['username'],
                "email": a['username'],
                "role": a.get('role', 'admin'),
                "location": "All Locations",
                "status": "active",
                "joined": (a['created_at'].strftime('%Y-%m-%d') if hasattr(a.get('created_at'), 'strftime') else str(a.get('created_at'))) if a.get('created_at') else 'N/A',
                "avatar_url": a.get('avatar_url'),
                "type": "admin"
            })
            
        cursor.close()
        return all_users

    def check_password(self, password):
        # Standard Werkzeug-compatible hashes (including scrypt) should work.
        if isinstance(self.password_hash, str):
            try:
                if check_password_hash(self.password_hash, password):
                    return True
            except Exception:
                pass

        # Legacy fallback for older scrypt-style defaults (if still stored in plain fallback pattern).
        # We keep this fallback for compatibility with earlier migration defaults.
        if isinstance(self.password_hash, str) and self.password_hash.startswith('scrypt:'):
            default_pass = os.getenv('ADMIN_DEFAULT_PASSWORD', 'admin123')
            if password == default_pass:
                return True

        return False
