from typing import Optional
from sqlalchemy.orm import Session

from ..models.notification import Notification


def notify_user(
    db: Session,
    tenant_id: int,
    user_id: int,
    title: str,
    message: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
) -> None:
    """
    Create an in-app notification. Does not commit - call sites already have
    an open transaction for the action being notified about, so this rides
    along with that same commit (same reasoning as record_audit_log).
    """
    db.add(Notification(
        tenant_id=tenant_id,
        user_id=user_id,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=entity_id,
    ))
