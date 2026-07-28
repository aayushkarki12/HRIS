"""Permission catalog and permission-checking dependencies for the RBAC
system layered on top of the legacy User.role string.

A permission is a short "category.action" string that corresponds to one
real enforcement point in the backend. PERMISSIONS below is the definitive
catalog - it's seeded into the `permissions` table by the
add_rbac_tables migration, and the admin UI only ever displays/toggles rows
from that table. Adding a new permission means: add it here, add a
migration to insert the row, and actually check it somewhere with
require_permission()/require_permission_with_limit().

This coexists with the legacy get_current_admin_user/get_current_manager_user
dependencies in app/core/dependencies.py during the rollout - endpoints are
being migrated to the new system incrementally, not all at once. A user
still on the legacy string role "admin" is treated as having every
permission (see _legacy_admin_bypass) so existing admins aren't locked out
of newly-migrated endpoints just because they haven't been assigned a Role
row yet.
"""
from dataclasses import dataclass
from typing import Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .dependencies import get_current_active_user, get_current_tenant
from ..models.user import User
from ..models.tenant import Tenant
from ..models.employee import Employee
from ..models.rbac import RolePermission, ApprovalLimit

# (key, category, description) - category groups the admin UI's permission matrix.
PERMISSIONS: list[tuple[str, str, str]] = [
    # Administration
    ("users.manage", "Administration", "Create, edit, deactivate, and reset passwords for other users"),
    ("tenant.manage", "Administration", "Edit tenant/company settings"),
    ("roles.manage", "Administration", "Create/edit roles, permissions, seniority levels, and approval limits"),
    ("audit_log.view", "Administration", "View the audit trail"),
    # Employees
    ("employees.view_all", "Employees", "View every employee, not just their own department"),
    ("employees.edit", "Employees", "Create and edit employee records"),
    ("employees.view_sensitive", "Employees", "View bank account and social security details for other employees"),
    # Leave & attendance
    ("leave.approve", "Leave & Attendance", "Approve or reject leave requests"),
    ("timesheet.approve", "Leave & Attendance", "Approve timesheets"),
    ("attendance.manage", "Leave & Attendance", "Manage attendance records and work locations"),
    ("documents.verify", "Leave & Attendance", "Verify uploaded employee documents"),
    # Finance
    ("voucher.create", "Finance", "Create vouchers"),
    ("voucher.approve", "Finance", "Approve submitted vouchers"),
    ("voucher.post", "Finance", "Post vouchers to the general ledger"),
    ("journal_entry.manage", "Finance", "Create and post journal entries directly"),
    ("invoice.manage", "Finance", "Create and send invoices"),
    ("invoice.approve", "Finance", "Record payments against invoices"),
    ("expense.approve_manager", "Finance", "Give first (manager) approval on expense claims"),
    ("expense.approve_accounting", "Finance", "Give final (accounting) approval and release payment on expense claims"),
    ("budget.approve", "Finance", "Approve submitted budgets"),
    ("payroll.manage", "Finance", "Run payroll and manage salary structures"),
    ("payroll.view_all", "Finance", "View every employee's salary, not just their own"),
    ("inventory.manage", "Finance", "Manage warehouses, items, and stock movements"),
    ("reports.financial.view", "Finance", "View financial reports and the general ledger"),
]

# The permissions ApprovalLimit can put a numeric ceiling on - "approve
# something with a dollar amount" actions the seniority axis is meant to gate.
AMOUNT_LIMITED_PERMISSIONS = {
    "voucher.approve",
    "invoice.approve",
    "expense.approve_accounting",
    "budget.approve",
}


@dataclass
class PermissionContext:
    user: User
    employee: Optional[Employee]
    limit: Optional[float]  # None = unlimited (or not an amount-limited permission)


def _legacy_admin_bypass(user: User) -> bool:
    return user.role == "admin"


def _user_permission_keys(db: Session, user: User) -> set:
    """Every permission key the user's role grants. Empty if the user has no
    role_id yet (not migrated onto the new system)."""
    if not user.role_id:
        return set()
    rows = db.query(RolePermission.permission_key).filter(RolePermission.role_id == user.role_id).all()
    return {r[0] for r in rows}


def user_has_permission(db: Session, user: User, key: str) -> bool:
    if _legacy_admin_bypass(user):
        return True
    return key in _user_permission_keys(db, user)


def get_approval_limit(
    db: Session, tenant_id: int, user: User, employee: Optional[Employee], key: str
) -> Optional[float]:
    """Most specific match wins (role+seniority > either alone > neither).
    No matching row at all means unlimited (returns None)."""
    if key not in AMOUNT_LIMITED_PERMISSIONS:
        return None
    seniority_id = employee.seniority_level_id if employee else None

    rows = db.query(ApprovalLimit).filter(
        ApprovalLimit.tenant_id == tenant_id,
        ApprovalLimit.permission_key == key,
    ).all()

    matching = [
        r for r in rows
        if (r.role_id is None or r.role_id == user.role_id)
        and (r.seniority_level_id is None or r.seniority_level_id == seniority_id)
    ]
    if not matching:
        return None

    def specificity(r: ApprovalLimit) -> int:
        return (1 if r.role_id is not None else 0) + (1 if r.seniority_level_id is not None else 0)

    matching.sort(key=specificity, reverse=True)
    return matching[0].max_amount


def require_permission(key: str):
    """FastAPI dependency factory: 403s unless the current user's role grants `key`."""
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not user_has_permission(db, current_user, key):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {key}")
        return current_user
    return _dependency


def require_permission_with_limit(key: str):
    """FastAPI dependency factory for amount-limited permissions: 403s unless
    granted, otherwise returns a PermissionContext carrying the resolved
    approval limit (None = unlimited) so the endpoint can compare it against
    the amount being approved before proceeding."""
    def _dependency(
        current_user: User = Depends(get_current_active_user),
        tenant: Tenant = Depends(get_current_tenant),
        db: Session = Depends(get_db),
    ) -> PermissionContext:
        if not user_has_permission(db, current_user, key):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {key}")
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id, Employee.tenant_id == tenant.id
        ).first()
        limit = None if _legacy_admin_bypass(current_user) else get_approval_limit(
            db, tenant.id, current_user, employee, key
        )
        return PermissionContext(user=current_user, employee=employee, limit=limit)
    return _dependency
