import logging
import os
import re
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_tenant
from ...core.permissions import require_permission, user_has_permission
from ...core.audit import record_audit_log
from ...core.config import settings
from ...core.security import get_password_hash, generate_refresh_token, hash_refresh_token
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.rbac import Role, SeniorityLevel
from ...models.password_reset_token import PasswordResetToken
from ...models.refresh_token import RefreshToken
from ...models.audit_log import AuditLog
from ...schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeHistoryEntry

logger = logging.getLogger(__name__)

# An invite link needs to survive an admin creating an employee today and the
# new hire clicking it days later - much longer than the 60-minute window a
# self-service "I forgot my password" email gets (see auth.py).
EMPLOYEE_INVITE_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

router = APIRouter(prefix="/employees", tags=["employees"])

EDIT = require_permission("employees.edit")

# Bank/SSN data should only ever be visible to the employee themself or to
# admin/manager roles (legacy) / employees.view_sensitive (new RBAC) - not to
# any coworker who happens to share a department or be able to enumerate IDs.
_SENSITIVE_FIELDS = ("bank_account", "bank_routing", "social_security")


def _can_view_all(db: Session, viewer: User) -> bool:
    return viewer.role in ("admin", "manager") or user_has_permission(db, viewer, "employees.view_all")


def _generate_username(db: Session, tenant_id: int, email: str) -> str:
    """Derive a unique, alphanumeric username from the local part of an email
    (matches UserBase's alphanumeric-only validator), appending a numeric
    suffix on collision."""
    base = re.sub(r"[^a-zA-Z0-9]", "", email.split("@")[0]).lower() or "user"
    candidate = base
    suffix = 1
    while db.query(User).filter(User.tenant_id == tenant_id, User.username == candidate).first():
        suffix += 1
        candidate = f"{base}{suffix}"
    return candidate


def _create_login_and_invite(db: Session, tenant: Tenant, employee_data: EmployeeCreate) -> tuple[User, str]:
    """Provision a User account for a brand-new employee who doesn't have one
    yet, with an unusable random password, and return (user, invite_link) so
    the admin can hand the link to the new hire. They land on /invitation,
    see their read-only profile details, and pick their own username (the
    generated one here is just a placeholder) and password - a dedicated
    flow from "forgot password" (see PasswordResetToken.is_invite), with a
    longer expiry suited to an invite than a same-session reset."""
    if db.query(User).filter(User.tenant_id == tenant.id, User.email == employee_data.email).first():
        raise HTTPException(status_code=400, detail="A user account with this email already exists")

    role = None
    if employee_data.role_id is not None:
        role = db.query(Role).filter(Role.id == employee_data.role_id, Role.tenant_id == tenant.id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Designation (role) not found")

    user = User(
        username=_generate_username(db, tenant.id, employee_data.email),
        email=employee_data.email,
        hashed_password=get_password_hash(secrets.token_urlsafe(32)),
        first_name=employee_data.first_name,
        last_name=employee_data.last_name,
        role="user",
        role_id=role.id if role else None,
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.flush()

    raw_token = generate_refresh_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        tenant_id=tenant.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=EMPLOYEE_INVITE_TOKEN_EXPIRE_MINUTES),
        used=False,
        is_invite=True,
    ))

    invite_link = f"{settings.FRONTEND_URL}/invitation?token={raw_token}"
    return user, invite_link


def _tenant_id_prefix(tenant_name: str) -> str:
    """"Cantor Dust" -> "CD"; a single-word name takes its first 3 letters;
    an empty/unusable name falls back to "EMP"."""
    words = re.findall(r"[A-Za-z0-9]+", tenant_name or "")
    if len(words) >= 2:
        prefix = "".join(w[0] for w in words[:4]).upper()
    elif words:
        prefix = words[0][:3].upper()
    else:
        prefix = ""
    return prefix or "EMP"


def _generate_employee_id(db: Session, tenant: Tenant) -> str:
    """{TENANT_PREFIX}_001, _002, ... per tenant (e.g. "CD_001" for "Cantor
    Dust"). Employees are only ever soft-deleted (is_active=False), so the
    row count is a stable, monotonically increasing starting point; the
    uniqueness loop below covers the rare case where an earlier employee_id
    was set explicitly and collides with the next candidate."""
    prefix = _tenant_id_prefix(tenant.name)
    seq = db.query(Employee).filter(Employee.tenant_id == tenant.id).count() + 1
    while True:
        candidate = f"{prefix}_{seq:03d}"
        exists = db.query(Employee).filter(
            Employee.tenant_id == tenant.id, Employee.employee_id == candidate
        ).first()
        if not exists:
            return candidate
        seq += 1


def _seniority_name(db: Session, seniority_level_id: Optional[int]) -> Optional[str]:
    if not seniority_level_id:
        return None
    level = db.query(SeniorityLevel).filter(SeniorityLevel.id == seniority_level_id).first()
    return level.name if level else None


def _invite_status(db: Session, user_id: Optional[int]) -> Optional[str]:
    """"invited" (link sent, not yet used), "expired" (link sent, never
    used, past its expiry), "accepted" (link used, or no invite record at
    all - e.g. self-registered or linked to a pre-existing user), or None if
    there's no login at all."""
    if not user_id:
        return None
    token = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id, PasswordResetToken.is_invite.is_(True)
    ).order_by(PasswordResetToken.created_at.desc()).first()
    if not token or token.used:
        return "accepted"
    if token.expires_at < datetime.now(timezone.utc):
        return "expired"
    return "invited"


def _to_response(db: Session, employee: Employee, viewer: User) -> EmployeeResponse:
    resp = EmployeeResponse.model_validate(employee)
    resp.invite_status = _invite_status(db, employee.user_id)
    resp.projects = [pm.project.name for pm in employee.project_memberships if pm.project]
    is_privileged = viewer.role in ("admin", "manager") or user_has_permission(db, viewer, "employees.view_sensitive")
    is_self = employee.user_id == viewer.id
    if not is_privileged and not is_self:
        for field in _SENSITIVE_FIELDS:
            setattr(resp, field, None)
    return resp

# ============================================
# STATIC ROUTES - MUST COME FIRST
# ============================================

@router.get("/me", response_model=EmployeeResponse)
def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get current user's employee profile.
    """
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == tenant.id
    ).first()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    return employee

@router.put("/me", response_model=EmployeeResponse)
def update_my_profile(
    employee_data: EmployeeUpdate,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update current user's employee profile (self-service).
    """
    try:
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee profile not found")

        # Get only the fields that were sent
        update_data = employee_data.model_dump(exclude_unset=True)

        logger.info(f"Updating employee {employee.id} with data: {update_data}")

        # Allowed fields for self-service
        allowed_fields = [
            'first_name', 'last_name', 'email', 'phone',
            'date_of_birth', 'gender', 'marital_status', 'address',
            'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relation',
            'bank_name', 'bank_account', 'bank_routing', 'social_security',
            'skills', 'certifications', 'profile_picture'
        ]

        # Update only allowed fields
        for key, value in update_data.items():
            if key in allowed_fields:
                # Handle empty strings - convert to None
                if value == "":
                    value = None
                # Handle date_of_birth specifically
                if key == 'date_of_birth' and value:
                    # Try to parse the date
                    try:
                        if isinstance(value, str):
                            # If it's a string, convert to date
                            from datetime import datetime
                            value = datetime.strptime(value, '%Y-%m-%d').date()
                    except Exception as e:
                        logger.error(f"Error parsing date: {e}", exc_info=True)
                        # If date parsing fails, set to None
                        value = None

                logger.info(f"Setting {key} = {value}")
                setattr(employee, key, value)

        db.commit()
        db.refresh(employee)

        return employee
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_my_profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")

@router.post("/me/avatar")
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Upload a profile picture for the current user."""
    # Extension is derived from this validated content-type mapping, never
    # from the client-supplied filename - avatars are served from a public
    # static mount, so trusting a client filename's extension here would let
    # an attacker upload real HTML/script under an "image" content-type
    # header and have it served (and executed) as that file type.
    avatar_extensions = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    if file.content_type not in avatar_extensions:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or GIF images are allowed")

    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    ext = avatar_extensions[file.content_type]
    filename = f"{uuid.uuid4().hex}{ext}"
    avatars_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "avatars")
    os.makedirs(avatars_dir, exist_ok=True)
    file_path = os.path.join(avatars_dir, filename)

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB)")

    with open(file_path, "wb") as f:
        f.write(contents)

    url = f"/uploads/avatars/{filename}"
    employee.profile_picture = url
    db.commit()
    db.refresh(employee)
    return {"url": url}


@router.delete("/me/avatar")
def delete_my_avatar(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Remove the current user's profile picture, reverting to initials."""
    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    if employee.profile_picture:
        avatars_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "avatars")
        filename = employee.profile_picture.rsplit("/", 1)[-1]
        file_path = os.path.join(avatars_dir, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)

    employee.profile_picture = None
    db.commit()
    return {"message": "Profile picture removed"}


@router.get("", response_model=List[EmployeeResponse])
def get_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    department: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all employees for the current tenant. Admin user accounts never show up
    as "employees" here, and non-admin/manager users only see colleagues in
    their own department.
    """
    try:
        query = db.query(Employee).outerjoin(User, Employee.user_id == User.id).filter(
            Employee.tenant_id == tenant.id,
            or_(User.role != "admin", Employee.user_id.is_(None))
        )

        if not _can_view_all(db, current_user):
            me = db.query(Employee).filter(
                Employee.user_id == current_user.id,
                Employee.tenant_id == tenant.id
            ).first()
            if not me:
                return []
            query = query.filter(Employee.department == me.department)
        elif department:
            query = query.filter(Employee.department == department)

        if search:
            query = query.filter(
                (Employee.first_name.contains(search)) |
                (Employee.last_name.contains(search)) |
                (Employee.email.contains(search))
            )

        employees = query.offset(skip).limit(limit).all()
        return [_to_response(db, e, current_user) for e in employees]
    except Exception as e:
        logger.error(f"Error in get_employees: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=dict)
def get_employee_stats(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get employee statistics for the current tenant."""
    try:
        total = db.query(Employee).filter(Employee.tenant_id == tenant.id).count()
        active = db.query(Employee).filter(
            Employee.tenant_id == tenant.id,
            Employee.is_active == True
        ).count()

        departments = db.query(
            Employee.department,
            func.count(Employee.id).label('count')
        ).filter(Employee.tenant_id == tenant.id).group_by(Employee.department).all()

        return {
            "total": total,
            "active": active,
            "inactive": total - active,
            "departments": [{"name": d.department, "count": d.count} for d in departments]
        }
    except Exception as e:
        logger.error(f"Error in get_employee_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(
    employee_data: EmployeeCreate,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new employee for the current tenant (admin/employees.edit only).
    employee_id is auto-generated (EMP0001, ...) when not explicitly supplied.
    When no user_id is given, also provisions a login for the new hire and
    returns a one-time invite_link (share it with them to set their own
    password and log in) - it is never retrievable again after this response."""
    try:
        data = employee_data.model_dump(exclude={"employee_id", "role_id"})

        if employee_data.employee_id:
            existing = db.query(Employee).filter(
                Employee.employee_id == employee_data.employee_id,
                Employee.tenant_id == tenant.id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Employee ID already exists")
            employee_id = employee_data.employee_id
        else:
            employee_id = _generate_employee_id(db, tenant)

        invite_link = None
        if not employee_data.user_id:
            new_user, invite_link = _create_login_and_invite(db, tenant, employee_data)
            data["user_id"] = new_user.id

        db_employee = Employee(**data, employee_id=employee_id, tenant_id=tenant.id)
        db.add(db_employee)
        db.flush()

        record_audit_log(db, tenant.id, current_user.id, "create", "employee", db_employee.id,
                          f"Registered new employee {db_employee.first_name} {db_employee.last_name}")

        db.commit()
        db.refresh(db_employee)
        resp = EmployeeResponse.model_validate(db_employee)
        resp.invite_link = invite_link
        resp.invite_status = _invite_status(db, db_employee.user_id)
        return resp
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error in create_employee: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# DYNAMIC ROUTES - MUST COME AFTER STATIC ROUTES
# ============================================

@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get employee by ID for the current tenant.

    Non-admin/manager users may only view their own record - not a colleague's,
    even one in the same department (that's the employees.view_all permission,
    or the legacy admin/manager roles). Bank/SSN fields are separately redacted
    even for a self-view unless the viewer is also employees.view_sensitive.
    """
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        if not _can_view_all(db, current_user) and employee.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this employee"
            )

        return _to_response(db, employee, current_user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_employee: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{employee_id}/history", response_model=List[EmployeeHistoryEntry])
def get_employee_history(
    employee_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Career timeline: when they joined, plus every position/department/
    seniority change since (recorded by update_employee as a "career_change"
    audit log entry). Same authorization as GET /{employee_id} - self or
    admin/manager/employees.view_all, not just any same-department colleague.

    Salary/compensation history isn't tracked here - that lives in the
    separate SalaryStructure/payroll system, which this doesn't touch."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if not _can_view_all(db, current_user) and employee.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this employee")

    logs = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant.id,
        AuditLog.entity_type == "employee",
        AuditLog.entity_id == employee.id,
        AuditLog.action == "career_change",
    ).order_by(AuditLog.created_at).all()

    # "Joined as X" should reflect what they joined AS, not their current
    # position/department - if there's since been a career_change, walk its
    # "Field: OLD → NEW" text (a format we generate ourselves in
    # update_employee, so parsing it back is safe) to recover the original
    # value from the oldest recorded change instead of assuming "current".
    joined_position, joined_department = employee.position, employee.department
    if logs:
        for match in re.finditer(r"(Position|Department): (.*?) → (.*?)(?:;|$)", logs[0].details or ""):
            field, old_val, _ = match.groups()
            if field == "Position":
                joined_position = old_val
            elif field == "Department":
                joined_department = old_val

    entries = [
        EmployeeHistoryEntry(
            date=datetime.combine(employee.joining_date, datetime.min.time(), tzinfo=timezone.utc),
            action="joined",
            details=f"Joined as {joined_position} in {joined_department}",
        )
    ]
    for log in logs:
        entries.append(EmployeeHistoryEntry(id=log.id, date=log.created_at, action="career_change", details=log.details or ""))

    entries.sort(key=lambda e: e.date)
    return entries


@router.delete("/{employee_id}/history")
def clear_employee_history(
    employee_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Delete every career_change entry for this employee (admin/employees.edit
    only). Only clears the recorded history - it does not touch the employee's
    current position/department/seniority/employment_type, and the synthetic
    "joined" entry (derived from joining_date) isn't affected since it isn't a
    stored row."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    deleted = db.query(AuditLog).filter(
        AuditLog.tenant_id == tenant.id,
        AuditLog.entity_type == "employee",
        AuditLog.entity_id == employee.id,
        AuditLog.action == "career_change",
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Cleared {deleted} career history entr{'y' if deleted == 1 else 'ies'}"}


@router.delete("/{employee_id}/history/{log_id}")
def delete_employee_history_entry(
    employee_id: int,
    log_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Delete a single career_change entry (admin/employees.edit only). The
    synthetic "joined" entry has no id and can't be targeted here."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    log = db.query(AuditLog).filter(
        AuditLog.id == log_id,
        AuditLog.tenant_id == tenant.id,
        AuditLog.entity_type == "employee",
        AuditLog.entity_id == employee.id,
        AuditLog.action == "career_change",
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="History entry not found")

    db.delete(log)
    db.commit()
    return {"message": "History entry deleted"}


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update employee for the current tenant (admin/employees.edit only).
    Changes to position/department/seniority_level_id are recorded as
    structured audit log entries (see _seniority_name below) so they show up
    on the employee's history timeline - this is how a "promotion" is done,
    there's no separate promote endpoint."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        tracked_fields = {
            "position": "Position", "department": "Department", "seniority_level_id": "Seniority",
            "employment_type": "Employment Status",
        }
        update_data = employee_data.model_dump(exclude_unset=True)
        # Not a column on Employee - only controls the career_change audit
        # entry's timestamp below (see EmployeeUpdate.effective_date), so pop
        # it out before the setattr loop rather than trying to assign it onto
        # the model.
        effective_date = update_data.pop("effective_date", None)
        changes = []
        for field, label in tracked_fields.items():
            if field in update_data and update_data[field] != getattr(employee, field):
                old_val = _seniority_name(db, employee.seniority_level_id) if field == "seniority_level_id" else getattr(employee, field)
                new_val = _seniority_name(db, update_data[field]) if field == "seniority_level_id" else update_data[field]
                changes.append(f"{label}: {old_val or 'none'} → {new_val or 'none'}")

        for key, value in update_data.items():
            setattr(employee, key, value)

        if changes:
            # If the admin gave an effective_date, timestamp the audit entry
            # (and therefore where it lands on the history timeline) at that
            # date instead of "now" - lets a promotion recorded today be
            # backdated or scheduled for a future effective date.
            occurred_at = (
                datetime.combine(effective_date, datetime.min.time(), tzinfo=timezone.utc)
                if effective_date else None
            )
            record_audit_log(db, tenant.id, current_user.id, "career_change", "employee", employee.id,
                              "; ".join(changes), occurred_at=occurred_at)

        db.commit()
        db.refresh(employee)
        return _to_response(db, employee, current_user)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error in update_employee: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate employee for the current tenant (admin/employees.edit only).
    Also deactivates and logs out their linked login - previously this only
    flipped Employee.is_active, which the login itself never checks, so a
    "deactivated" employee could still sign in. Reversible via
    PUT /{employee_id}/activate."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        if employee.user_id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account this way")

        employee.is_active = False
        if employee.user_id:
            user = db.query(User).filter(User.id == employee.user_id).first()
            if user:
                user.is_active = False
                db.query(RefreshToken).filter(
                    RefreshToken.user_id == user.id, RefreshToken.revoked.is_(False)
                ).update({"revoked": True})

        record_audit_log(db, tenant.id, current_user.id, "deactivate", "employee", employee.id,
                          f"Deactivated {employee.first_name} {employee.last_name}")
        db.commit()
        return {"message": "Employee deactivated - their login is now blocked"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Error in delete_employee: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{employee_id}/activate", response_model=EmployeeResponse)
def activate_employee(
    employee_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Reactivate a previously-deactivated employee and their login."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    employee.is_active = True
    if employee.user_id:
        user = db.query(User).filter(User.id == employee.user_id).first()
        if user:
            user.is_active = True

    record_audit_log(db, tenant.id, current_user.id, "activate", "employee", employee.id,
                      f"Reactivated {employee.first_name} {employee.last_name}")
    db.commit()
    db.refresh(employee)
    return _to_response(db, employee, current_user)


@router.post("/{employee_id}/resend-invite")
def resend_invite(
    employee_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Mint a fresh invite link for an employee whose login hasn't been set
    up yet (or who lost the original one) - the original raw token can't be
    recovered since only its hash is stored, so this issues a new one and
    invalidates any still-pending ones."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not employee.user_id:
        raise HTTPException(status_code=400, detail="This employee has no login to invite")

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == employee.user_id,
        PasswordResetToken.is_invite.is_(True),
        PasswordResetToken.used.is_(False),
    ).update({"used": True})

    raw_token = generate_refresh_token()
    db.add(PasswordResetToken(
        user_id=employee.user_id,
        tenant_id=tenant.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=EMPLOYEE_INVITE_TOKEN_EXPIRE_MINUTES),
        used=False,
        is_invite=True,
    ))
    record_audit_log(db, tenant.id, current_user.id, "resend_invite", "employee", employee.id,
                      f"Resent invite link for {employee.first_name} {employee.last_name}")
    db.commit()

    return {"invite_link": f"{settings.FRONTEND_URL}/invitation?token={raw_token}"}


@router.delete("/{employee_id}/permanent")
def permanently_delete_employee(
    employee_id: int,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Permanently remove an employee (and their login, if any) - unlike
    DELETE /{employee_id} this can't be undone. Only safe for employees with
    no real activity: assignments/leaves/timesheets/attendances/documents
    cascade-delete with the Employee row, but anything they approved, posted,
    or created elsewhere (vouchers, journal entries, expense claims, ...)
    still references their user_id with no cascade, so the delete is
    rejected rather than silently orphaning or wiping unrelated financial/
    audit records - deactivate those employees instead."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id, Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if employee.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own employee record")

    name = f"{employee.first_name} {employee.last_name}"
    user_id = employee.user_id

    try:
        if user_id:
            db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete()
            db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
            # Audit trail is deliberately kept (not deleted) with the actor
            # reference cleared - see AuditLog's own docstring.
            db.query(AuditLog).filter(AuditLog.user_id == user_id).update({"user_id": None})

        record_audit_log(db, tenant.id, current_user.id, "delete", "employee", employee.id,
                          f"Permanently deleted {name}")

        db.delete(employee)
        db.flush()

        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                db.delete(user)
                db.flush()

        db.commit()
        return {"message": f"{name} was permanently deleted"}
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"{name} has related records (approvals, vouchers, timesheets, etc.) and can't be permanently "
                   f"deleted. Deactivate them instead.",
        )
