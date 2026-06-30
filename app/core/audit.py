from typing import Optional
from sqlalchemy.orm import Session

from ..models.audit_log import AuditLog


def record_audit_log(
    db: Session,
    tenant_id: int,
    user_id: Optional[int],
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    details: Optional[str] = None,
) -> None:
    """
    Append an audit log entry. Does not commit - call sites already have an
    open transaction for the action being logged, so this rides along with
    that same commit rather than creating a separate round-trip.
    """
    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    ))
