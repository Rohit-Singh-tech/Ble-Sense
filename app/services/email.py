import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_smtp_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using standard Python smtplib with Gmail SMTP.
    Runs synchronously; should be executed via FastAPI BackgroundTasks.
    """
    # Create message container
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    message["To"] = to_email

    # Record the MIME type of HTML.
    part = MIMEText(html_content, "html")
    message.attach(part)

    try:
        # Connect to Gmail SMTP
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()  # Secure the connection
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, message.as_string())
        print(f"📧 Email successfully sent to {to_email} | Subject: {subject}")
    except Exception as e:
        print(f"❌ Failed to send email to {to_email}: {e}")


def send_verification_email(to_email: str, username: str, verification_url: str):
    """Send verification email containing link to activate account."""
    subject = "Verify your BLE Sense Ecosystem Account"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #4A90E2; text-align: center;">Welcome to BLE Sense Ecosystem!</h2>
                <p>Hello <strong>{username}</strong>,</p>
                <p>Thank you for registering. Please click the button below to verify your email address and activate your account:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" style="background-color: #4A90E2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
                </div>
                <p>If the button doesn't work, copy and paste the following link into your web browser:</p>
                <p style="word-break: break-all; color: #888;">{verification_url}</p>
                <p>This link will expire in 24 hours.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.8em; color: #777; text-align: center;">This is an automated system message. Please do not reply directly to this email.</p>
            </div>
        </body>
    </html>
    """
    send_smtp_email(to_email, subject, html_content)


def send_password_reset_email(to_email: str, username: str, reset_url: str):
    """Send password reset link."""
    subject = "Reset Your BLE Sense Account Password"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #D0021B; text-align: center;">Password Reset Request</h2>
                <p>Hello <strong>{username}</strong>,</p>
                <p>We received a request to reset the password for your account. Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_url}" style="background-color: #D0021B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                </div>
                <p>If the button doesn't work, copy and paste the following link into your web browser:</p>
                <p style="word-break: break-all; color: #888;">{reset_url}</p>
                <p>If you did not request this, you can safely ignore this email; your password will remain unchanged.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.8em; color: #777; text-align: center;">This is an automated system message. Please do not reply directly to this email.</p>
            </div>
        </body>
    </html>
    """
    send_smtp_email(to_email, subject, html_content)


def send_invitation_email(to_email: str, username: str, temporary_password: str, login_url: str):
    """Send email verification and temporary credentials to an invited user."""
    subject = "You have been invited to the BLE Sense Ecosystem"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <h2 style="color: #2ECC71; text-align: center;">Welcome to BLE Sense!</h2>
                <p>Hello <strong>{username}</strong>,</p>
                <p>An administrator has created an account for you in the BLE Sense Ecosystem.</p>
                <p>Here are your temporary login credentials:</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 5px solid #2ECC71; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Username:</strong> {username}</p>
                    <p style="margin: 5px 0;"><strong>Email:</strong> {to_email}</p>
                    <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #eef; padding: 2px 5px; border-radius: 3px;">{temporary_password}</code></p>
                </div>
                <p>Please click the button below to log in and change your password immediately:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{login_url}" style="background-color: #2ECC71; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Log In Now</a>
                </div>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 0.8em; color: #777; text-align: center;">This is an automated system message. Please do not reply directly to this email.</p>
            </div>
        </body>
    </html>
    """
    send_smtp_email(to_email, subject, html_content)
