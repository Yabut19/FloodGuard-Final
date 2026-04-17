import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_smtp_config():
    """Retrieve SMTP configuration from the central Config class."""
    return {
        'SERVER': Config.MAIL_SERVER,
        'PORT': Config.MAIL_PORT,
        'USERNAME': Config.MAIL_USERNAME,
        'PASSWORD': Config.MAIL_PASSWORD
    }

def send_credentials_email(to_email, full_name, password, is_admin=False):
    """
    Sends an email to the user with their login credentials.
    Supports both standard mobile users and LGU admin accounts.
    """
    conf = get_smtp_config()
    
    # Check if we have actual credentials (ignore placeholders)
    if not conf['USERNAME'] or 'your_email' in conf['USERNAME'] or not conf['PASSWORD'] or 'your_app' in conf['PASSWORD']:
        logger.error("Email credentials not configured. Please check your .env file.")
        return False, "Email credentials missing in server configuration"

    try:
        msg = MIMEMultipart()
        msg['From'] = conf['USERNAME']
        msg['To'] = to_email
        
        if is_admin:
            msg['Subject'] = "Your FloodGuard LGU Admin Account Credentials"
            header_text = f"Welcome to the FloodGuard Administration, {full_name}!"
            body_intro = "An LGU Admin account has been created for you in the FloodGuard system."
        else:
            msg['Subject'] = "Your FloodGuard Account Credentials"
            header_text = f"Welcome to FloodGuard, {full_name}!"
            body_intro = "Your account has been successfully created."

        body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #74C5E6;">{header_text}</h2>
                <p>{body_intro}</p>
                
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #74C5E6; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Username/Email:</strong> {to_email}</p>
                    <p style="margin: 5px 0 0 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 5px; border-radius: 4px;">{password}</code></p>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Log in to the FloodGuard system.</li>
                    <li>Change your password immediately through the Profile/Security settings.</li>
                </ol>
                
                <p>Stay safe,<br><strong>The FloodGuard Team</strong></p>
            </div>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))

        logger.info(f"Connecting to SMTP: {conf['SERVER']}:{conf['PORT']}")
        
        # Determine if we should use SSL or TLS based on port
        if conf['PORT'] == 465:
            server = smtplib.SMTP_SSL(conf['SERVER'], conf['PORT'])
        else:
            server = smtplib.SMTP(conf['SERVER'], conf['PORT'])
            server.set_debuglevel(1)
            server.starttls()
            
        try:
            server.login(conf['USERNAME'], conf['PASSWORD'])
            server.send_message(msg)
            logger.info(f"Credentials successfully sent to {to_email}")
            return True, "Email sent successfully"
        finally:
            server.quit()
    
    except smtplib.SMTPAuthenticationError:
        logger.error(f"Authentication failed for {conf['USERNAME']}. Is the App Password correct?")
        return False, "SMTP Authentication Failed: Check your Gmail App Password"
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}", exc_info=True)
        return False, f"SMTP System Error: {str(e)}"

def send_dismissal_notification(reporter_email, reporter_name, report_type, location, rejection_reason):
    """
    Sends an email to the reporter when their report is dismissed.
    """
    conf = get_smtp_config()
    
    if not conf['USERNAME'] or 'your_email' in conf['USERNAME']:
        return False, "Email server not configured"

    try:
        msg = MIMEMultipart()
        msg['From'] = conf['USERNAME']
        msg['To'] = reporter_email
        msg['Subject'] = "Update on Your FloodGuard Report"

        body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h2>Hello {reporter_name},</h2>
            <p>We have reviewed your report and wanted to provide an update.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Report Details:</h3>
                <p><strong>Type:</strong> {report_type}</p>
                <p><strong>Location:</strong> {location}</p>
            </div>
            
            <p><strong>Status:</strong> <span style="color: #dc3545;">Report Dismissed</span></p>
            <p><strong>Reason:</strong> {rejection_reason}</p>
            
            <p>After careful review by our LGU officials, this report has been determined to not require immediate action at this time.</p>
            
            <p>Thank you for helping keep our community safe,<br>The FloodGuard Team</p>
          </body>
        </html>
        """
        
        msg.attach(MIMEText(body, 'html'))
        
        if conf['PORT'] == 465:
            server = smtplib.SMTP_SSL(conf['SERVER'], conf['PORT'])
        else:
            server = smtplib.SMTP(conf['SERVER'], conf['PORT'])
            server.starttls()
            
        try:
            server.login(conf['USERNAME'], conf['PASSWORD'])
            server.send_message(msg)
            return True, "Dismissal notification sent successfully"
        finally:
            server.quit()
    
    except Exception as e:
        logger.error(f"Failed to send dismissal notification: {str(e)}")
        return False, f"Error: {str(e)}"
