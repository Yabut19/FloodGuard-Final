import os
import sys
import logging

# Add the current directory to path so we can import config and utils
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import Config
from utils.email_service import send_credentials_email

# Configure logging to see the debug output
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SMTP_TEST")

def run_test():
    print("\n--- FloodGuard SMTP Diagnostic Tool ---")
    
    # 1. Check Config
    print(f"\n1. Checking Configuration:")
    print(f"   MAIL_SERVER: {Config.MAIL_SERVER}")
    print(f"   MAIL_PORT:   {Config.MAIL_PORT}")
    print(f"   MAIL_USER:   {Config.MAIL_USERNAME}")
    
    if not Config.MAIL_USERNAME or "your_email" in Config.MAIL_USERNAME:
        print("\n[!] ERROR: MAIL_USERNAME is still set to placeholder.")
        print("    Please create a .env file in the backend_flask folder.")
        return

    if not Config.MAIL_PASSWORD or "your_app" in Config.MAIL_PASSWORD:
        print("\n[!] ERROR: MAIL_PASSWORD is still set to placeholder.")
        print("    You must provide a valid Gmail App Password in your .env file.")
        return

    print("\n2. Attempting to send test email...")
    target_email = input("\nEnter a recipient email address to send a test to: ")
    
    if not target_email or "@" not in target_email:
        print("Invalid email address. Aborting.")
        return

    success, message = send_credentials_email(target_email, "Test User", "TEST-PASS-123", is_admin=False)
    
    if success:
        print("\n[SUCCESS] Email sent successfully!")
        print(f"Message: {message}")
        print("\nPlease check your inbox (including Spam folder).")
    else:
        print("\n[FAILURE] Failed to send email.")
        print(f"Error Message: {message}")
        print("\nPossible Causes:")
        print(" - Incorrect App Password (16 characters, no spaces)")
        print(" - 2-Step Verification not enabled on Google Account")
        print(" - Port 587 (TLS) or 465 (SSL) blocked by network/firewall")
        print(" - Google account has 'Less secure app access' issues (App Password is required)")

if __name__ == "__main__":
    run_test()
