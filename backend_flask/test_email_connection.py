import sys
import os

# Add the current directory to path so we can import our modules
sys.path.append(os.getcwd())

from utils.email_service import send_credentials_email
from config import Config

def test_connection():
    print("="*50)
    print("FloodGuard Email Connection Tester")
    print("="*50)
    
    # Force reload config to pick up .env changes
    from dotenv import load_dotenv
    load_dotenv(override=True)
    
    print(f"Current Config:")
    print(f" - Server:   {Config.MAIL_SERVER}")
    print(f" - Port:     {Config.MAIL_PORT}")
    print(f" - Username: {Config.MAIL_USERNAME}")
    print(f" - Password: {'*' * len(Config.MAIL_PASSWORD) if Config.MAIL_PASSWORD else 'MISSING'}")
    print("-" * 50)

    test_recipient = Config.MAIL_USERNAME
    print(f"Sending test email to: {test_recipient}...")
    
    success, message = send_credentials_email(
        to_email=test_recipient,
        full_name="System Tester",
        password="TestPassword123",
        is_admin=False
    )
    
    if success:
        print("\nSUCCESS!")
        print("The email was sent. Please check your inbox.")
    else:
        print("\nFAILED")
        print(f"Error Message: {message}")

if __name__ == "__main__":
    test_connection()
