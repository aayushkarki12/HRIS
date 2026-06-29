from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import date, datetime, timedelta
import traceback

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant, get_current_employee
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.project import Project
from ...models.timesheet import Timesheet, TimesheetEntry
from ...schemas.timesheet import TimesheetCreate, TimesheetResponse, TimesheetEntryCreate, TimesheetEntryResponse

router = APIRouter(prefix="/timesheets", tags=["timesheets"])

@router.get("/my", response_model=List[TimesheetResponse])
def get_my_timesheets(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get current employee's timesheets."""
    try:
        return db.query(Timesheet).filter(
            Timesheet.employee_id == current_employee.id,
            Timesheet.tenant_id == tenant.id
        ).order_by(Timesheet.week_start_date.desc()).all()
    except Exception as e:
        print(f"Error in get_my_timesheets: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=TimesheetResponse, status_code=status.HTTP_201_CREATED)
def create_timesheet(
    timesheet_data: TimesheetCreate,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new timesheet."""
    try:
        print(f"Received timesheet data: {timesheet_data}")
        
        if not timesheet_data.week_start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Week start date is required"
            )
        
        # Check if timesheet already exists
        existing = db.query(Timesheet).filter(
            Timesheet.employee_id == current_employee.id,
            Timesheet.week_start_date == timesheet_data.week_start_date,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Timesheet already exists for this week"
            )
        
        week_end_date = timesheet_data.week_start_date + timedelta(days=6)
        
        db_timesheet = Timesheet(
            employee_id=current_employee.id,
            week_start_date=timesheet_data.week_start_date,
            week_end_date=week_end_date,
            status="draft",
            tenant_id=tenant.id
        )
        
        db.add(db_timesheet)
        db.commit()
        db.refresh(db_timesheet)
        return db_timesheet
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in create_timesheet: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create timesheet: {str(e)}"
        )

@router.post("/{timesheet_id}/entries", response_model=TimesheetEntryResponse)
def add_timesheet_entry(
    timesheet_id: int,
    entry_data: TimesheetEntryCreate,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Add an entry to a timesheet."""
    try:
        timesheet = db.query(Timesheet).filter(
            Timesheet.id == timesheet_id,
            Timesheet.employee_id == current_employee.id,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if not timesheet:
            raise HTTPException(status_code=404, detail="Timesheet not found")
        
        if timesheet.status != "draft":
            raise HTTPException(status_code=400, detail="Cannot modify submitted/approved timesheet")
        
        if entry_data.project_id:
            project = db.query(Project).filter(
                Project.id == entry_data.project_id,
                Project.tenant_id == tenant.id
            ).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
        
        db_entry = TimesheetEntry(
            timesheet_id=timesheet_id,
            project_id=entry_data.project_id,
            date=entry_data.date,
            hours=entry_data.hours,
            description=entry_data.description,
            is_billable=entry_data.is_billable,
            tenant_id=tenant.id
        )
        
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        
        # Update total hours
        total = db.query(func.sum(TimesheetEntry.hours)).filter(
            TimesheetEntry.timesheet_id == timesheet_id
        ).scalar()
        timesheet.total_hours = total or 0
        db.commit()
        
        return db_entry
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in add_timesheet_entry: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add entry: {str(e)}"
        )

@router.put("/{timesheet_id}/entries/{entry_id}", response_model=TimesheetEntryResponse)
def update_timesheet_entry(
    timesheet_id: int,
    entry_id: int,
    entry_data: TimesheetEntryCreate,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a timesheet entry."""
    try:
        timesheet = db.query(Timesheet).filter(
            Timesheet.id == timesheet_id,
            Timesheet.employee_id == current_employee.id,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if not timesheet:
            raise HTTPException(status_code=404, detail="Timesheet not found")
        
        if timesheet.status != "draft":
            raise HTTPException(status_code=400, detail="Cannot modify submitted/approved timesheet")
        
        entry = db.query(TimesheetEntry).filter(
            TimesheetEntry.id == entry_id,
            TimesheetEntry.timesheet_id == timesheet_id
        ).first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        for key, value in entry_data.model_dump(exclude_unset=True).items():
            setattr(entry, key, value)
        
        db.commit()
        db.refresh(entry)
        
        # Update total hours
        total = db.query(func.sum(TimesheetEntry.hours)).filter(
            TimesheetEntry.timesheet_id == timesheet_id
        ).scalar()
        timesheet.total_hours = total or 0
        db.commit()
        
        return entry
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in update_timesheet_entry: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update entry: {str(e)}"
        )

@router.delete("/{timesheet_id}/entries/{entry_id}")
def delete_timesheet_entry(
    timesheet_id: int,
    entry_id: int,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a timesheet entry."""
    try:
        timesheet = db.query(Timesheet).filter(
            Timesheet.id == timesheet_id,
            Timesheet.employee_id == current_employee.id,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if not timesheet:
            raise HTTPException(status_code=404, detail="Timesheet not found")
        
        if timesheet.status != "draft":
            raise HTTPException(status_code=400, detail="Cannot modify submitted/approved timesheet")
        
        entry = db.query(TimesheetEntry).filter(
            TimesheetEntry.id == entry_id,
            TimesheetEntry.timesheet_id == timesheet_id
        ).first()
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        db.delete(entry)
        db.commit()
        
        # Update total hours
        total = db.query(func.sum(TimesheetEntry.hours)).filter(
            TimesheetEntry.timesheet_id == timesheet_id
        ).scalar()
        timesheet.total_hours = total or 0
        db.commit()
        
        return {"message": "Entry deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in delete_timesheet_entry: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete entry: {str(e)}"
        )

@router.put("/{timesheet_id}/submit")
def submit_timesheet(
    timesheet_id: int,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Submit timesheet for approval."""
    try:
        timesheet = db.query(Timesheet).filter(
            Timesheet.id == timesheet_id,
            Timesheet.employee_id == current_employee.id,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if not timesheet:
            raise HTTPException(status_code=404, detail="Timesheet not found")
        
        if timesheet.status != "draft":
            raise HTTPException(status_code=400, detail="Timesheet already submitted")
        
        if timesheet.total_hours == 0:
            raise HTTPException(status_code=400, detail="Cannot submit empty timesheet")
        
        timesheet.status = "submitted"
        db.commit()
        
        return {"message": "Timesheet submitted for approval"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in submit_timesheet: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit timesheet: {str(e)}"
        )

@router.put("/{timesheet_id}/approve")
def approve_timesheet(
    timesheet_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Approve a timesheet (manager/admin only)."""
    try:
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Not authorized")
        
        timesheet = db.query(Timesheet).filter(
            Timesheet.id == timesheet_id,
            Timesheet.tenant_id == tenant.id
        ).first()
        
        if not timesheet:
            raise HTTPException(status_code=404, detail="Timesheet not found")
        
        timesheet.status = "approved"
        timesheet.approved_by = current_user.id
        timesheet.approved_at = datetime.now()
        db.commit()
        
        return {"message": "Timesheet approved"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error in approve_timesheet: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve timesheet: {str(e)}"
        )