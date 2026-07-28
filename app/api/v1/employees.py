import logging
import os
import re
import secrets
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
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
from ...models.rbac import Role
from ...models.password_reset_token import PasswordResetToken
from ...schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse

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


def _to_response(db: Session, employee: Employee, viewer: User) -> EmployeeResponse:
    resp = EmployeeResponse.model_validate(employee)
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


@router.get("", response_model=List[EmployeeResponse], include_in_schema=False)
@router.get("/", response_model=List[EmployeeResponse])
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

@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
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

    Non-admin/manager users may only view their own record or a colleague's
    record in their own department - and even then, bank/SSN fields are
    redacted unless the viewer is the employee themself or admin/manager.
    """
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        if not _can_view_all(db, current_user) and employee.user_id != current_user.id:
            me = db.query(Employee).filter(
                Employee.user_id == current_user.id,
                Employee.tenant_id == tenant.id
            ).first()
            if not me or me.department != employee.department:
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

@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: User = Depends(EDIT),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update employee for the current tenant (admin/employees.edit only)."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        for key, value in employee_data.model_dump(exclude_unset=True).items():
            setattr(employee, key, value)

        db.commit()
        db.refresh(employee)
        return employee
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
    """Deactivate employee for the current tenant (admin/employees.edit only)."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        employee.is_active = False
        db.commit()
        return {"message": "Employee deactivated successfully"}
    except Exception as e:
        logger.error(f"Error in delete_employee: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
