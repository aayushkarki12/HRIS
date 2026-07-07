import csv
import io
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.audit_log import AuditLog
from ...schemas.audit_log import AuditLogResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

# Maps the free-text entity_type taxonomy accumulated across the app to a small
# set of user-facing modules for filtering. Anything not listed falls back to "Other".
ENTITY_TYPE_TO_MODULE = {
    "voucher": "Accounting", "journal_entry": "Accounting", "account": "Accounting",
    "ledger_group": "Accounting", "invoice": "Accounting",
    "expense_claim": "Expenses",
    "leave": "HR", "attendance": "HR", "employee": "HR",
    "salary_structure": "Payroll", "payroll_run": "Payroll",
    "resource_request": "Resources",
    "auth": "Security", "user": "Security",
}

MODULES = sorted(set(ENTITY_TYPE_TO_MODULE.values())) + ["Other"]


def _apply_filters(query, entity_type, entity_id, user_id, action, module, start_date, end_date):
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if module:
        entity_types = [k for k, v in ENTITY_TYPE_TO_MODULE.items() if v == module]
        if module == "Other":
            query = query.filter(~AuditLog.entity_type.in_(ENTITY_TYPE_TO_MODULE.keys()))
        else:
            query = query.filter(AuditLog.entity_type.in_(entity_types))
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    return query


def _hydrate(log: AuditLog) -> AuditLog:
    log.module = ENTITY_TYPE_TO_MODULE.get(log.entity_type, "Other")
    return log


@router.get("/", response_model=List[AuditLogResponse])
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """View the audit trail for this tenant (managers and admins only)."""
    if current_user.role not in ("admin", "manager"):
        return []

    query = db.query(AuditLog).options(joinedload(AuditLog.user)).filter(AuditLog.tenant_id == tenant.id)
    query = _apply_filters(query, entity_type, entity_id, user_id, action, module, start_date, end_date)

    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [_hydrate(log) for log in logs]


@router.get("/meta")
def get_audit_log_meta(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Distinct actions and entity types actually present in this tenant's audit log, for filter dropdowns."""
    if current_user.role not in ("admin", "manager"):
        return {"actions": [], "entity_types": [], "modules": MODULES}

    actions = [r[0] for r in db.query(AuditLog.action).filter(AuditLog.tenant_id == tenant.id).distinct().all()]
    entity_types = [r[0] for r in db.query(AuditLog.entity_type).filter(AuditLog.tenant_id == tenant.id).distinct().all()]
    return {"actions": sorted(actions), "entity_types": sorted(entity_types), "modules": MODULES}


@router.get("/export")
def export_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Export the (filtered) audit trail as CSV."""
    if current_user.role not in ("admin", "manager"):
        return StreamingResponse(io.StringIO(""), media_type="text/csv")

    query = db.query(AuditLog).options(joinedload(AuditLog.user)).filter(AuditLog.tenant_id == tenant.id)
    query = _apply_filters(query, entity_type, entity_id, user_id, action, module, start_date, end_date)
    logs = query.order_by(AuditLog.created_at.desc()).limit(10000).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Timestamp", "User", "Module", "Entity Type", "Entity ID", "Action", "Severity", "Details", "IP Address", "User Agent"])
    for log in logs:
        user_label = f"{log.user.first_name} {log.user.last_name}".strip() if log.user else "-"
        writer.writerow([
            log.created_at.isoformat(), user_label, ENTITY_TYPE_TO_MODULE.get(log.entity_type, "Other"),
            log.entity_type, log.entity_id or "", log.action, log.severity, log.details or "",
            log.ip_address or "", log.user_agent or "",
        ])
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-trail.csv"},
    )
