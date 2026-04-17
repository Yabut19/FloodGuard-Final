from app import app
from utils.db import get_db
from werkzeug.security import generate_password_hash

def reset_lgu_password():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        new_password_hash = generate_password_hash('password123')
        
        cursor.execute(
            "UPDATE admins SET password = %s WHERE username = %s",
            (new_password_hash, 'moderator@lgu.gov')
        )
        db.commit()
        cursor.close()
        print("Successfully reset password for 'moderator@lgu.gov' to 'password123'")

if __name__ == "__main__":
    reset_lgu_password()
