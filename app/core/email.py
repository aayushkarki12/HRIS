import logging
import resend

from .config import settings

logger = logging.getLogger(__name__)

resend.api_key = settings.RESEND_API_KEY


def send_password_reset_email(to_email: str, first_name: str, reset_link: str) -> bool:
    """
    Sends the password reset email. Returns False on failure instead of
    raising - a delivery failure should not break the request/response
    cycle for /auth/forgot-password, which always returns a generic
    success message regardless of whether the email exists or sends.
    """
    if not settings.RESEND_API_KEY:
        logger.error("RESEND_API_KEY is not configured - cannot send password reset email")
        return False

    try:
        resend.Emails.send({
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": "Reset your HRIS password",
            "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                    <h2 style="color: #2c3e50;">Reset your password</h2>
                    <p>Hi {first_name},</p>
                    <p>We received a request to reset your HRIS account password. Click the button below to choose a new one. This link expires in 1 hour.</p>
                    <p style="margin: 24px 0;">
                        <a href="{reset_link}" style="background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reset Password</a>
                    </p>
                    <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email - your password won't change.</p>
                    <p style="color: #888; font-size: 13px;">If the button doesn't work, copy and paste this link: {reset_link}</p>
                </div>
            """,
        })
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False
