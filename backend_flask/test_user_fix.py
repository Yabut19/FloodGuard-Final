from app import app
from models.user import User

def test_user_barangay():
    with app.app_context():
        # Test find_by_username for a known user (Poland Diosana)
        user = User.find_by_username('landpo321@gmail.com')
        if user:
            print(f"User: {user.full_name}")
            print(f"Barangay: {user.barangay}")
            if user.barangay == "Sitio San Vicente":
                print("SUCCESS: Barangay retrieved correctly.")
            else:
                print(f"FAILED: Expected 'Sitio San Vicente', got '{user.barangay}'")
        else:
            print("FAILED: User not found.")

if __name__ == "__main__":
    test_user_barangay()
