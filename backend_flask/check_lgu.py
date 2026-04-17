from app import app
from utils.db import get_db

def check_lgu_moderator():
    with app.app_context():
        db = get_db()
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM admins WHERE username = %s", ('moderator@lgu.gov',))
        user = cursor.fetchone()
        cursor.close()
        
        if user:
            print("--- User Found ---")
            for key, value in user.items():
                if key != 'password': # Hide password for security
                    print(f"{key}: {value}")
            print(f"Password starts with: {user['password'][:10]}...")
            
            # Check if it matches 'password123'
            from werkzeug.security import check_password_hash
            matches = check_password_hash(user['password'], 'password123')
            print(f"Password 'password123' matches: {matches}")
        else:
            print("User 'moderator@lgu.gov' NOT found in admins table.")

if __name__ == "__main__":
    check_lgu_moderator()
