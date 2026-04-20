import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_smtp_conf():
    """Return validated SMTP config, or raise ValueError with a helpful message."""
    username = (Config.MAIL_USERNAME or "").strip()
    password = (Config.MAIL_PASSWORD or "").strip()
    server   = (Config.MAIL_SERVER  or "smtp.gmail.com").strip()
    port     = int(Config.MAIL_PORT or 587)

    placeholders = {"your_email@gmail.com", "your_gmail_address@gmail.com",
                    "floodguard.system@gmail.com"}
    if not username or username in placeholders or "your_email" in username:
        raise ValueError(
            "MAIL_USERNAME is not configured. "
            "Open backend_flask/.env and set MAIL_USERNAME to your Gmail address."
        )
    if not password or "your" in password or len(password) < 8:
        raise ValueError(
            "MAIL_PASSWORD is not configured. "
            "Open backend_flask/.env and set MAIL_PASSWORD to your 16-character Gmail App Password. "
            "Generate one at: https://myaccount.google.com/apppasswords"
        )
    return server, port, username, password


def _build_credentials_html(to_email: str, full_name: str, password: str, is_admin: bool) -> tuple:
    """Return (subject, html_body) for a credentials email."""
    if is_admin:
        subject     = "Your FloodGuard LGU Admin Account Credentials"
        header      = f"Welcome to FloodGuard Administration, {full_name}!"
        intro       = "An LGU Admin account has been created for you in the FloodGuard system."
        login_hint  = "Log in at the FloodGuard Web Admin portal."
    else:
        subject     = "Your FloodGuard Account Credentials"
        header      = f"Welcome to FloodGuard, {full_name}!"
        intro       = "Your FloodGuard mobile account has been successfully created."
        login_hint  = "Open the FloodGuard mobile app and log in."

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 30px auto; padding: 30px;
                    border: 1px solid #e2e8f0; border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.06);">

          <!-- Header -->
          <div style="text-align:center; margin-bottom: 24px;">
            <div style="background: linear-gradient(135deg,#1e40af,#3b82f6);
                        border-radius: 10px; padding: 20px;">
              <h1 style="color:#fff; margin:0; font-size:22px;">🌊 FloodGuard</h1>
              <p  style="color:rgba(255,255,255,0.85); margin:6px 0 0; font-size:13px;">
                  Community Flood Monitoring System
              </p>
            </div>
          </div>

          <h2 style="color:#1e40af; margin-top:0;">{header}</h2>
          <p>{intro}</p>
          <p>Your temporary login credentials are below. 
             <strong style="color:#dc2626;">Please change your password immediately after your first login.</strong>
          </p>

          <!-- Credentials Box -->
          <div style="background:#f0f9ff; border-left:4px solid #3b82f6;
                      border-radius:8px; padding:18px; margin:24px 0;">
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0; font-weight:bold; width:40%; color:#374151;">
                  📧 Email / Username:
                </td>
                <td style="padding:6px 0; color:#1e40af;">{to_email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold; color:#374151;">
                  🔑 Temporary Password:
                </td>
                <td style="padding:6px 0;">
                  <code style="background:#dbeafe; color:#1e40af;
                               padding:4px 10px; border-radius:6px;
                               font-size:15px; letter-spacing:2px;">
                    {password}
                  </code>
                </td>
              </tr>
            </table>
          </div>

          <!-- Steps -->
          <div style="background:#f8fafc; border-radius:8px; padding:18px; margin-bottom:24px;">
            <p style="margin:0 0 10px; font-weight:bold; color:#374151;">📋 Next Steps:</p>
            <ol style="margin:0; padding-left:20px; color:#4b5563;">
              <li style="margin-bottom:6px;">{login_hint}</li>
              <li style="margin-bottom:6px;">Enter your email and the temporary password above.</li>
              <li style="margin-bottom:6px;">
                You will be <strong>required to create a new password</strong>
                before you can continue.
              </li>
              <li>Keep your new password safe and do not share it.</li>
            </ol>
          </div>

          <p style="color:#6b7280; font-size:13px;">
            If you did not request this account, please contact FloodGuard support immediately.
          </p>

          <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;">
          <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0;">
            Stay safe,&nbsp;&nbsp;<strong>The FloodGuard Team</strong>
          </p>
        </div>
      </body>
    </html>
    """
    return subject, html


def _send_via_smtp(server_host, port, username, password, to_email, subject, html_body):
    """Connect to SMTP and send. Tries 587 first, falls back to 465 on failure."""
    msg = MIMEMultipart("alternative")
    msg["From"]    = f"FloodGuard System <{username}>"
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    def try_send(port_to_use):
        logger.info("SMTP connect → %s:%d (user=%s)", server_host, port_to_use, username)
        if port_to_use == 465:
            # SMTP over SSL
            with smtplib.SMTP_SSL(server_host, 465, timeout=20) as smtp:
                smtp.login(username, password)
                smtp.send_message(msg)
        else:
            # SMTP + STARTTLS
            with smtplib.SMTP(server_host, port_to_use, timeout=20) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(username, password)
                smtp.send_message(msg)

    # Try configured port first, then the alternative
    primary   = port
    alternate = 465 if port != 465 else 587
    try:
        try_send(primary)
        logger.info("Email sent to %s via port %d", to_email, primary)
        return
    except Exception as e:
        logger.warning("Port %d failed (%s), trying port %d...", primary, e, alternate)

    try_send(alternate)
    logger.info("Email sent to %s via port %d (fallback)", to_email, alternate)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def send_credentials_email(to_email: str, full_name: str, password: str,
                           is_admin: bool = False) -> tuple:
    """
    Send a welcome / credentials email to a newly created user.

    Returns (True, "Email sent successfully") on success,
    or (False, "<error description>") on failure.
    """
    try:
        server_host, port, username, mail_pass = _get_smtp_conf()
        subject, html = _build_credentials_html(to_email, full_name, password, is_admin)
        _send_via_smtp(server_host, port, username, mail_pass, to_email, subject, html)
        return True, "Email sent successfully"

    except ValueError as ve:
        # Configuration problem → log clearly for developer
        logger.error("Email config error: %s", ve)
        return False, str(ve)

    except smtplib.SMTPAuthenticationError:
        msg = (
            "Gmail authentication failed. "
            "Make sure MAIL_PASSWORD in .env is a 16-character App Password "
            "(not your regular Gmail password). "
            "Generate one at https://myaccount.google.com/apppasswords"
        )
        logger.error(msg)
        return False, msg

    except smtplib.SMTPException as e:
        logger.error("SMTP error sending to %s: %s", to_email, e)
        return False, f"SMTP error: {e}"

    except Exception as e:
        logger.error("Unexpected error sending email to %s: %s", to_email, e, exc_info=True)
        return False, f"Unexpected error: {e}"


def send_dismissal_notification(reporter_email: str, reporter_name: str,
                                report_type: str, location: str,
                                rejection_reason: str) -> tuple:
    """
    Notify a reporter that their flood report was dismissed.
    """
    try:
        server_host, port, username, mail_pass = _get_smtp_conf()
    except ValueError as ve:
        logger.warning("Dismissal email skipped — config not set: %s", ve)
        return False, str(ve)

    subject = "Update on Your FloodGuard Report"
    html = f"""
    <html>
      <body style="font-family:Arial,sans-serif; color:#333; line-height:1.6;">
        <div style="max-width:600px; margin:30px auto; padding:24px;
                    border:1px solid #e2e8f0; border-radius:12px;">
          <h2 style="color:#1e40af;">Hello {reporter_name},</h2>
          <p>Thank you for your flood report. Our LGU team has reviewed it and
             would like to share an update.</p>

          <div style="background:#f8fafc; padding:16px; border-radius:8px;
                      margin:20px 0; border-left:4px solid #94a3b8;">
            <p><strong>Report Type:</strong> {report_type}</p>
            <p><strong>Location:</strong> {location}</p>
            <p><strong>Status:</strong>
               <span style="color:#dc2626; font-weight:bold;">Dismissed</span></p>
            <p><strong>Reason:</strong> {rejection_reason}</p>
          </div>

          <p>After careful review, this report has been determined to not require
             immediate action at this time.</p>
          <p>Thank you for helping keep our community safe.</p>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:20px 0;">
          <p style="color:#9ca3af; font-size:12px; text-align:center;">
            The FloodGuard Team
          </p>
        </div>
      </body>
    </html>
    """
    try:
        _send_via_smtp(server_host, port, username, mail_pass,
                       reporter_email, subject, html)
        return True, "Dismissal notification sent"
    except Exception as e:
        logger.error("Failed to send dismissal notification: %s", e)
        return False, str(e)
