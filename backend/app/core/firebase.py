import logging
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from .config import settings

logger = logging.getLogger(__name__)

_app: Optional[firebase_admin.App] = None


def _get_app() -> Optional[firebase_admin.App]:
    """Lazily initializes the Firebase Admin SDK on first use, not at import
    time - the service-account credentials may not exist yet in dev/CI, and
    every other endpoint in this app should keep working regardless."""
    global _app
    if _app is not None:
        return _app
    if not settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        logger.error("FIREBASE_SERVICE_ACCOUNT_PATH is not configured - cannot verify phone OTP tokens")
        return None
    try:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
        _app = firebase_admin.initialize_app(cred)
        return _app
    except Exception:
        logger.exception("Failed to initialize Firebase Admin SDK")
        return None


def verify_phone_id_token(id_token: str) -> Optional[str]:
    """
    Verifies a Firebase ID token minted client-side after the user completed
    phone OTP verification (Firebase's invisible-reCAPTCHA + signInWithPhoneNumber
    flow - see the frontend's AcceptInvitation page). This backend never talks
    to Firebase's SMS API itself; it only checks the token's signature and
    claims server-side so a client can't just claim a phone number was verified.

    Returns the verified phone number (E.164, e.g. "+15551234567") on success,
    or None if the token is invalid/expired/has no phone claim, or Firebase
    isn't configured.
    """
    app = _get_app()
    if app is None:
        return None
    try:
        decoded = firebase_auth.verify_id_token(id_token, app=app)
    except Exception:
        logger.warning("Firebase ID token verification failed", exc_info=True)
        return None
    return decoded.get("phone_number")
