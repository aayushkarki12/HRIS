import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_tenant
from ...core.permissions import require_permission
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.employee import Employee
from ...models.tenant import Tenant
from ...models.rbac import Permission, Role, RolePermission, SeniorityLevel, ApprovalLimit
from ...models.department import Department
from ...schemas.rbac import (
    PermissionResponse, RoleCreate, RoleUpdate, RoleResponse,
    SeniorityLevelCreate, SeniorityLevelUpdate, SeniorityLevelResponse,
    ApprovalLimitCreate, ApprovalLimitUpdate, ApprovalLimitResponse,
)
from ...schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["roles & permissions"])

MANAGE = require_permission("roles.manage")


def _role_to_response(db: Session, role: Role) -> RoleResponse:
    keys = [rp.permission_key for rp in db.query(RolePermission).filter(RolePermission.role_id == role.id).all()]
    user_count = db.query(User).filter(User.role_id == role.id).count()
    resp = RoleResponse.model_validate(role)
    resp.permission_keys = keys
    resp.user_count = user_count
    return resp


def _seniority_to_response(db: Session, level: SeniorityLevel) -> SeniorityLevelResponse:
    resp = SeniorityLevelResponse.model_validate(level)
    resp.employee_count = db.query(Employee).filter(Employee.seniority_level_id == level.id).count()
    return resp


def _limit_to_response(limit: ApprovalLimit) -> ApprovalLimitResponse:
    resp = ApprovalLimitResponse.model_validate(limit)
    resp.role_name = limit.role.name if limit.role else None
    resp.seniority_level_name = limit.seniority_level.name if limit.seniority_level else None
    return resp


def _department_to_response(db: Session, department: Department) -> DepartmentResponse:
    resp = DepartmentResponse.model_validate(department)
    resp.employee_count = db.query(Employee).filter(
        Employee.tenant_id == department.tenant_id, Employee.department == department.name
    ).count()
    return resp


# ============ PERMISSIONS (read-only catalog) ============

@router.get("/permissions", response_model=List[PermissionResponse])
def list_permissions(
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db),
):
    return db.query(Permission).order_by(Permission.category, Permission.key).all()


# ============ ROLES ============

@router.get("/roles", response_model=List[RoleResponse])
def list_roles(
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    roles = db.query(Role).filter(Role.tenant_id == tenant.id).order_by(Role.is_system.desc(), Role.name).all()
    return [_role_to_response(db, r) for r in roles]


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    data: RoleCreate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    known_keys = {p.key for p in db.query(Permission.key).all()}
    unknown = set(data.permission_keys) - known_keys
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown permission key(s): {', '.join(sorted(unknown))}")

    role = Role(tenant_id=tenant.id, name=data.name, description=data.description, is_system=False)
    db.add(role)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A role named '{data.name}' already exists")

    for key in data.permission_keys:
        db.add(RolePermission(role_id=role.id, permission_key=key))

    record_audit_log(db, tenant.id, current_user.id, "create", "role", role.id, f"Created role '{role.name}'")
    db.commit()
    db.refresh(role)
    return _role_to_response(db, role)


@router.put("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    data: RoleUpdate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant.id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if data.name is not None and data.name != role.name:
        if role.is_system:
            raise HTTPException(status_code=400, detail="System roles (Admin/Manager/Employee) cannot be renamed")
        role.name = data.name
    if data.description is not None:
        role.description = data.description

    if data.permission_keys is not None:
        known_keys = {p.key for p in db.query(Permission.key).all()}
        unknown = set(data.permission_keys) - known_keys
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown permission key(s): {', '.join(sorted(unknown))}")
        db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        for key in data.permission_keys:
            db.add(RolePermission(role_id=role.id, permission_key=key))

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A role named '{data.name}' already exists")

    record_audit_log(db, tenant.id, current_user.id, "update", "role", role.id, f"Updated role '{role.name}'")
    db.commit()
    db.refresh(role)
    return _role_to_response(db, role)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == tenant.id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles (Admin/Manager/Employee) cannot be deleted")

    in_use = db.query(User).filter(User.role_id == role.id).count()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"{in_use} user(s) still have this role - reassign them before deleting it",
        )

    db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
    db.query(ApprovalLimit).filter(ApprovalLimit.role_id == role.id).delete()
    record_audit_log(db, tenant.id, current_user.id, "delete", "role", role.id, f"Deleted role '{role.name}'")
    db.delete(role)
    db.commit()
    return {"message": "Role deleted successfully"}


# ============ SENIORITY LEVELS ============

@router.get("/seniority-levels", response_model=List[SeniorityLevelResponse])
def list_seniority_levels(
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    levels = db.query(SeniorityLevel).filter(SeniorityLevel.tenant_id == tenant.id).order_by(SeniorityLevel.rank).all()
    return [_seniority_to_response(db, lvl) for lvl in levels]


@router.post("/seniority-levels", response_model=SeniorityLevelResponse, status_code=status.HTTP_201_CREATED)
def create_seniority_level(
    data: SeniorityLevelCreate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    level = SeniorityLevel(tenant_id=tenant.id, name=data.name, rank=data.rank)
    db.add(level)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A seniority level named '{data.name}' already exists")
    record_audit_log(db, tenant.id, current_user.id, "create", "seniority_level", level.id, f"Created seniority level '{level.name}'")
    db.commit()
    db.refresh(level)
    return _seniority_to_response(db, level)


@router.put("/seniority-levels/{level_id}", response_model=SeniorityLevelResponse)
def update_seniority_level(
    level_id: int,
    data: SeniorityLevelUpdate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    level = db.query(SeniorityLevel).filter(SeniorityLevel.id == level_id, SeniorityLevel.tenant_id == tenant.id).first()
    if not level:
        raise HTTPException(status_code=404, detail="Seniority level not found")
    if data.name is not None:
        level.name = data.name
    if data.rank is not None:
        level.rank = data.rank
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A seniority level named '{data.name}' already exists")
    record_audit_log(db, tenant.id, current_user.id, "update", "seniority_level", level.id, f"Updated seniority level '{level.name}'")
    db.commit()
    db.refresh(level)
    return _seniority_to_response(db, level)


@router.delete("/seniority-levels/{level_id}")
def delete_seniority_level(
    level_id: int,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    level = db.query(SeniorityLevel).filter(SeniorityLevel.id == level_id, SeniorityLevel.tenant_id == tenant.id).first()
    if not level:
        raise HTTPException(status_code=404, detail="Seniority level not found")
    in_use = db.query(Employee).filter(Employee.seniority_level_id == level.id).count()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"{in_use} employee(s) still have this seniority level - reassign them before deleting it",
        )
    db.query(ApprovalLimit).filter(ApprovalLimit.seniority_level_id == level.id).delete()
    record_audit_log(db, tenant.id, current_user.id, "delete", "seniority_level", level.id, f"Deleted seniority level '{level.name}'")
    db.delete(level)
    db.commit()
    return {"message": "Seniority level deleted successfully"}


# ============ APPROVAL LIMITS ============

@router.get("/approval-limits", response_model=List[ApprovalLimitResponse])
def list_approval_limits(
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    limits = db.query(ApprovalLimit).filter(ApprovalLimit.tenant_id == tenant.id).all()
    return [_limit_to_response(l) for l in limits]


@router.post("/approval-limits", response_model=ApprovalLimitResponse, status_code=status.HTTP_201_CREATED)
def create_approval_limit(
    data: ApprovalLimitCreate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    if not db.query(Permission).filter(Permission.key == data.permission_key).first():
        raise HTTPException(status_code=400, detail=f"Unknown permission key: {data.permission_key}")
    if data.role_id and not db.query(Role).filter(Role.id == data.role_id, Role.tenant_id == tenant.id).first():
        raise HTTPException(status_code=404, detail="Role not found")
    if data.seniority_level_id and not db.query(SeniorityLevel).filter(
        SeniorityLevel.id == data.seniority_level_id, SeniorityLevel.tenant_id == tenant.id
    ).first():
        raise HTTPException(status_code=404, detail="Seniority level not found")

    limit = ApprovalLimit(
        tenant_id=tenant.id, role_id=data.role_id, seniority_level_id=data.seniority_level_id,
        permission_key=data.permission_key, max_amount=data.max_amount,
    )
    db.add(limit)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A limit for this exact role/seniority/permission combination already exists")
    record_audit_log(db, tenant.id, current_user.id, "create", "approval_limit", limit.id,
                      f"Created approval limit for {data.permission_key}: {data.max_amount}")
    db.commit()
    db.refresh(limit)
    return _limit_to_response(limit)


@router.put("/approval-limits/{limit_id}", response_model=ApprovalLimitResponse)
def update_approval_limit(
    limit_id: int,
    data: ApprovalLimitUpdate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    limit = db.query(ApprovalLimit).filter(ApprovalLimit.id == limit_id, ApprovalLimit.tenant_id == tenant.id).first()
    if not limit:
        raise HTTPException(status_code=404, detail="Approval limit not found")
    limit.max_amount = data.max_amount
    record_audit_log(db, tenant.id, current_user.id, "update", "approval_limit", limit.id,
                      f"Updated approval limit for {limit.permission_key}: {data.max_amount}")
    db.commit()
    db.refresh(limit)
    return _limit_to_response(limit)


@router.delete("/approval-limits/{limit_id}")
def delete_approval_limit(
    limit_id: int,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    limit = db.query(ApprovalLimit).filter(ApprovalLimit.id == limit_id, ApprovalLimit.tenant_id == tenant.id).first()
    if not limit:
        raise HTTPException(status_code=404, detail="Approval limit not found")
    record_audit_log(db, tenant.id, current_user.id, "delete", "approval_limit", limit.id,
                      f"Deleted approval limit for {limit.permission_key} (was unlimited beyond this)")
    db.delete(limit)
    db.commit()
    return {"message": "Approval limit deleted successfully - this permission is now unlimited for that combination"}


# ============ DEPARTMENTS ============

@router.get("/departments", response_model=List[DepartmentResponse])
def list_departments(
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    departments = db.query(Department).filter(Department.tenant_id == tenant.id).order_by(Department.name).all()
    return [_department_to_response(db, d) for d in departments]


@router.post("/departments", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    data: DepartmentCreate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    department = Department(tenant_id=tenant.id, name=data.name)
    db.add(department)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A department named '{data.name}' already exists")
    record_audit_log(db, tenant.id, current_user.id, "create", "department", department.id, f"Created department '{department.name}'")
    db.commit()
    db.refresh(department)
    return _department_to_response(db, department)


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
def update_department(
    department_id: int,
    data: DepartmentUpdate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    department = db.query(Department).filter(Department.id == department_id, Department.tenant_id == tenant.id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    old_name = department.name
    department.name = data.name
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail=f"A department named '{data.name}' already exists")

    if old_name != data.name:
        # Employee.department is a plain string, not a foreign key (see
        # models/department.py) - renaming here would otherwise silently
        # orphan every employee record still carrying the old name.
        db.query(Employee).filter(
            Employee.tenant_id == tenant.id, Employee.department == old_name
        ).update({Employee.department: data.name}, synchronize_session=False)

    record_audit_log(db, tenant.id, current_user.id, "update", "department", department.id,
                      f"Renamed department '{old_name}' to '{data.name}'")
    db.commit()
    db.refresh(department)
    return _department_to_response(db, department)


@router.delete("/departments/{department_id}")
def delete_department(
    department_id: int,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    department = db.query(Department).filter(Department.id == department_id, Department.tenant_id == tenant.id).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    in_use = db.query(Employee).filter(Employee.tenant_id == tenant.id, Employee.department == department.name).count()
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"{in_use} employee(s) are still in this department - reassign them before deleting it",
        )

    record_audit_log(db, tenant.id, current_user.id, "delete", "department", department.id, f"Deleted department '{department.name}'")
    db.delete(department)
    db.commit()
    return {"message": "Department deleted successfully"}
