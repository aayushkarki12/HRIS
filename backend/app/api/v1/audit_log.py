import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.audit_log import AuditLog
from ...schemas.audit_log import AuditLogResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("/", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """View the audit trail for this tenant (admin only)."""
    query = db.query(AuditLog).filter(AuditLog.tenant_id == tenant.id)

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
