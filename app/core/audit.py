from typing import Optional
from fastapi import Request
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
    request: Optional[Request] = None,
    severity: str = "info",
) -> None:
    """
    Append an audit log entry. Does not commit - call sites already have an
    open transaction for the action being logged, so this rides along with
    that same commit rather than creating a separate round-trip.

    `request` is optional and purely additive: pass it (e.g. from login/logout/
    password-change endpoints) to capture the caller's IP and user agent.
    Existing call sites that don't pass it keep working exactly as before,
    just without those two fields populated.
    """
    ip_address = None
    user_agent = None
    if request is not None:
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        if user_agent and len(user_agent) > 255:
            user_agent = user_agent[:255]

    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
        severity=severity,
    ))
