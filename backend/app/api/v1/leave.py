from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant, get_current_employee
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.leave import LeaveType, Leave, LeaveBalance
from ...schemas.leave import (
    LeaveTypeCreate, LeaveTypeResponse,
    LeaveCreate, LeaveUpdate, LeaveResponse,
    LeaveBalanceResponse
)

router = APIRouter(prefix="/leaves", tags=["leaves"])

# ============ Leave Types ============

@router.get("/types", response_model=List[LeaveTypeResponse])
def get_leave_types(
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all leave types for current tenant."""
    return db.query(LeaveType).filter(
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).all()

@router.post("/types", response_model=LeaveTypeResponse)
def create_leave_type(
    leave_type_data: LeaveTypeCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new leave type (admin only)."""
    existing = db.query(LeaveType).filter(
        LeaveType.code == leave_type_data.code,
        LeaveType.tenant_id == tenant.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Leave type code already exists")
    
    db_leave_type = LeaveType(**leave_type_data.model_dump(), tenant_id=tenant.id)
    db.add(db_leave_type)
    db.commit()
    db.refresh(db_leave_type)
    return db_leave_type

# ============ Leave Requests ============

@router.get("/my", response_model=List[LeaveResponse])
def get_my_leaves(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all leave requests for current employee."""
    return db.query(Leave).filter(
        Leave.employee_id == current_employee.id,
        Leave.tenant_id == tenant.id
    ).order_by(Leave.created_at.desc()).all()

@router.get("/pending", response_model=List[LeaveResponse])
def get_pending_leaves(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all pending leave requests."""
    query = db.query(Leave).filter(
        Leave.tenant_id == tenant.id,
        Leave.status == "pending"
    )
    
    # If manager, show pending for their department
    if current_user.role == "manager":
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if employee:
            query = query.join(Employee).filter(Employee.department == employee.department)
    elif current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if employee:
            query = query.filter(Leave.employee_id == employee.id)
        else:
            return []
    
    return query.all()

@router.get("/{leave_id}", response_model=LeaveResponse)
def get_leave(
    leave_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get leave request by ID."""
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == tenant.id
    ).first()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Check authorization
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or leave.employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    return leave

@router.post("/", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
def create_leave_request(
    leave_data: LeaveCreate,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a leave request."""
    # Validate leave type
    leave_type = db.query(LeaveType).filter(
        LeaveType.id == leave_data.leave_type_id,
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).first()
    if not leave_type:
        raise HTTPException(status_code=404, detail="Leave type not found")
    
    # Calculate total days
    total_days = (leave_data.end_date - leave_data.start_date).days + 1
    
    # Check leave balance
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == current_employee.id,
        LeaveBalance.leave_type_id == leave_data.leave_type_id,
        LeaveBalance.year == date.today().year
    ).first()
    
    if balance and balance.remaining_days < total_days:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient leave balance. Available: {balance.remaining_days} days"
        )
    
    # Check for overlapping leave requests
    overlapping = db.query(Leave).filter(
        Leave.employee_id == current_employee.id,
        Leave.status.in_(["pending", "approved"]),
        Leave.start_date <= leave_data.end_date,
        Leave.end_date >= leave_data.start_date
    ).first()
    
    if overlapping:
        raise HTTPException(
            status_code=400,
            detail="You already have a leave request for this period"
        )
    
    # Create leave request
    db_leave = Leave(
        employee_id=current_employee.id,
        leave_type_id=leave_data.leave_type_id,
        start_date=leave_data.start_date,
        end_date=leave_data.end_date,
        total_days=total_days,
        reason=leave_data.reason,
        status="pending",
        tenant_id=tenant.id
    )
    
    db.add(db_leave)
    db.commit()
    db.refresh(db_leave)
    
    return db_leave

@router.put("/{leave_id}/approve", response_model=LeaveResponse)
def approve_leave(
    leave_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Approve a leave request."""
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == tenant.id,
        Leave.status == "pending"
    ).first()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Check authorization
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve leaves")
    
    if current_user.role == "manager":
        manager_employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        employee = db.query(Employee).filter(Employee.id == leave.employee_id).first()
        if not manager_employee or not employee or employee.department != manager_employee.department:
            raise HTTPException(status_code=403, detail="Not authorized to approve this leave")
    
    leave.status = "approved"
    leave.approved_by = current_user.id
    leave.approved_at = datetime.now()
    
    # Update leave balance
    balance = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == leave.employee_id,
        LeaveBalance.leave_type_id == leave.leave_type_id,
        LeaveBalance.year == date.today().year
    ).first()
    
    if balance:
        balance.used_days += leave.total_days
        balance.remaining_days = balance.total_days - balance.used_days + balance.carried_over

    record_audit_log(db, tenant.id, current_user.id, "approve", "leave", leave.id,
                      f"Approved leave for employee {leave.employee_id} ({leave.total_days} days)")

    db.commit()
    db.refresh(leave)

    return leave

@router.put("/{leave_id}/reject", response_model=LeaveResponse)
def reject_leave(
    leave_id: int,
    reason: Optional[str] = Query(None, description="Rejection reason"),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Reject a leave request."""
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == tenant.id,
        Leave.status == "pending"
    ).first()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Check authorization (same as approve)
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized to reject leaves")
    
    if current_user.role == "manager":
        manager_employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        employee = db.query(Employee).filter(Employee.id == leave.employee_id).first()
        if not manager_employee or not employee or employee.department != manager_employee.department:
            raise HTTPException(status_code=403, detail="Not authorized to reject this leave")
    
    leave.status = "rejected"
    leave.rejected_by = current_user.id
    leave.rejected_at = datetime.now()
    if reason:
        leave.reason = (leave.reason or "") + f"\n\nRejection reason: {reason}"

    record_audit_log(db, tenant.id, current_user.id, "reject", "leave", leave.id, reason)

    db.commit()
    db.refresh(leave)

    return leave

@router.put("/{leave_id}/cancel")
def cancel_leave(
    leave_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Cancel a leave request."""
    leave = db.query(Leave).filter(
        Leave.id == leave_id,
        Leave.tenant_id == tenant.id
    ).first()
    
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    # Check authorization
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or leave.employee_id != employee.id:
            raise HTTPException(status_code=403, detail="Not authorized")
    
    if leave.status in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Cannot cancel a leave that is already approved or rejected")
    
    leave.status = "cancelled"
    leave.cancelled_by = current_user.id
    leave.cancelled_at = datetime.now()
    
    db.commit()
    db.refresh(leave)
    
    return {"message": "Leave cancelled successfully"}

# ============ Leave Balances ============

@router.get("/balances/my", response_model=List[LeaveBalanceResponse])
def get_my_leave_balances(
    current_employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db)
):
    """Get current employee's leave balances."""
    balances = db.query(LeaveBalance).filter(
        LeaveBalance.employee_id == current_employee.id,
        LeaveBalance.year == date.today().year
    ).all()
    return balances

@router.post("/balances/calculate")
def calculate_leave_balances(
    year: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Calculate leave balances for all employees (admin only)."""
    leave_types = db.query(LeaveType).filter(
        LeaveType.tenant_id == tenant.id,
        LeaveType.is_active == True
    ).all()
    
    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.is_active == True
    ).all()
    
    created_count = 0
    updated_count = 0
    
    for employee in employees:
        for leave_type in leave_types:
            balance = db.query(LeaveBalance).filter(
                LeaveBalance.employee_id == employee.id,
                LeaveBalance.leave_type_id == leave_type.id,
                LeaveBalance.year == year
            ).first()
            
            if not balance:
                balance = LeaveBalance(
                    employee_id=employee.id,
                    leave_type_id=leave_type.id,
                    year=year,
                    total_days=leave_type.days_per_year,
                    used_days=0,
                    remaining_days=leave_type.days_per_year,
                    carried_over=0
                )
                db.add(balance)
                created_count += 1
            else:
                # Update if needed
                if balance.total_days != leave_type.days_per_year:
                    balance.total_days = leave_type.days_per_year
                    balance.remaining_days = balance.total_days - balance.used_days + balance.carried_over
                    updated_count += 1
    
    db.commit()
    
    return {
        "message": "Leave balances calculated successfully",
        "created": created_count,
        "updated": updated_count
    }