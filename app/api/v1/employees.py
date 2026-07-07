import logging
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from datetime import date

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/employees", tags=["employees"])

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
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP, or GIF images are allowed")

    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    ext = os.path.splitext(file.filename or "avatar.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    avatars_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads", "avatars")
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

        if current_user.role not in ("admin", "manager"):
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
        return employees
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
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new employee for the current tenant (admin only)."""
    try:
        existing = db.query(Employee).filter(
            Employee.employee_id == employee_data.employee_id,
            Employee.tenant_id == tenant.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Employee ID already exists")
        
        db_employee = Employee(**employee_data.model_dump(), tenant_id=tenant.id)
        db.add(db_employee)
        db.flush()

        record_audit_log(db, tenant.id, current_user.id, "create", "employee", db_employee.id,
                          f"Registered new employee {db_employee.first_name} {db_employee.last_name}")

        db.commit()
        db.refresh(db_employee)
        return db_employee
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
    """Get employee by ID for the current tenant."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == employee_id,
            Employee.tenant_id == tenant.id
        ).first()
        
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        return employee
    except Exception as e:
        logger.error(f"Error in get_employee: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    employee_data: EmployeeUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update employee for the current tenant (admin only)."""
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
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate employee for the current tenant (admin only)."""
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