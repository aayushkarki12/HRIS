import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
import pytz

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant, get_current_employee
from ...core.location import get_location_status
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.attendance import Attendance, Break, WorkLocation
from ...schemas.attendance import AttendanceResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["attendance"])

def get_current_datetime():
    """Get current datetime with timezone."""
    return datetime.now(pytz.UTC)

def determine_status_from_time(clock_in_time: datetime) -> str:
    """
    Determine attendance status based on clock-in time.
    - Before 10:00 AM -> Present
    - 10:00 AM to 11:00 AM -> Late
    - After 11:00 AM -> Half Day
    """
    local_time = clock_in_time.astimezone(pytz.timezone('Asia/Kathmandu'))
    hour = local_time.hour
    minute = local_time.minute
    
    if hour < 10 or (hour == 10 and minute == 0):
        return "present"
    elif hour < 11 or (hour == 11 and minute == 0):
        return "late"
    else:
        return "half-day"

@router.get("/my", response_model=List[AttendanceResponse])
def get_my_attendance(
    start_date: Optional[date] = Query(None, description="Start date"),
    end_date: Optional[date] = Query(None, description="End date"),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get current employee's attendance records."""
    try:
        query = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.tenant_id == tenant.id
        )
        
        if start_date:
            query = query.filter(Attendance.date >= start_date)
        if end_date:
            query = query.filter(Attendance.date <= end_date)
        
        return query.order_by(Attendance.date.desc()).all()
    except Exception as e:
        logger.error(f"Error in get_my_attendance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats", response_model=dict)
def get_attendance_stats(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get attendance statistics."""
    try:
        query = db.query(Attendance).filter(Attendance.tenant_id == tenant.id)
        
        if current_user.role not in ["admin", "manager"]:
            employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if employee:
                query = query.filter(Attendance.employee_id == employee.id)
        
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = date(today.year, today.month, 1)
        
        today_attendance = query.filter(Attendance.date == today).first()
        week_attendance = query.filter(Attendance.date >= week_start, Attendance.date <= today).all()
        month_attendance = query.filter(Attendance.date >= month_start, Attendance.date <= today).all()
        
        status_counts = {
            "present": 0, "absent": 0, "late": 0, "half-day": 0, "holiday": 0, "leave": 0, "left": 0
        }
        
        for att in month_attendance:
            if att.status in status_counts:
                status_counts[att.status] += 1
        
        return {
            "today": {
                "status": today_attendance.status if today_attendance else "not_clocked",
                "clocked_in": bool(today_attendance and today_attendance.clock_in),
                "clocked_out": bool(today_attendance and today_attendance.clock_out),
                "total_hours": today_attendance.total_hours if today_attendance else 0,
                "location_status": today_attendance.location_status if today_attendance else "unknown"
            },
            "week": {
                "total_days": len(week_attendance),
                "status_counts": status_counts
            },
            "month": {
                "total_days": len(month_attendance),
                "status_counts": status_counts
            }
        }
    except Exception as e:
        logger.error(f"Error in get_attendance_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clock-in")
def clock_in(
    latitude: Optional[float] = Query(None, description="Current latitude"),
    longitude: Optional[float] = Query(None, description="Current longitude"),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Clock in for the day with location tracking."""
    try:
        today = date.today()
        
        existing = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()
        
        if existing and existing.clock_in:
            raise HTTPException(status_code=400, detail="Already clocked in today")
        
        now = get_current_datetime()

        # Determine location status by checking the office and any active work locations
        location_status = "unknown"
        location_label = "Location not provided"
        work_location_id = None
        location_name = None
        if latitude and longitude:
            work_locations = db.query(WorkLocation).filter(
                WorkLocation.tenant_id == tenant.id,
                WorkLocation.is_active == True
            ).all()
            location_status, location_label, work_location_id, location_name = get_location_status(
                latitude, longitude, tenant, work_locations
            )

        # Determine attendance status based on clock-in time
        status = determine_status_from_time(now)

        if not existing:
            attendance = Attendance(
                employee_id=current_employee.id,
                date=today,
                clock_in=now,
                status=status,
                tenant_id=tenant.id,
                clock_in_latitude=latitude,
                clock_in_longitude=longitude,
                location_status=location_status,
                work_location_id=work_location_id,
                location_name=location_name
            )
            db.add(attendance)
            db.commit()
            db.refresh(attendance)
            return {
                "message": "Clocked in successfully",
                "time": now.isoformat(),
                "status": status,
                "location_status": location_status,
                "location_label": location_label,
                "location_name": location_name,
                "attendance_id": attendance.id
            }
        else:
            existing.clock_in = now
            existing.clock_in_latitude = latitude
            existing.clock_in_longitude = longitude
            existing.location_status = location_status
            existing.work_location_id = work_location_id
            existing.location_name = location_name
            existing.status = status
            db.commit()
            db.refresh(existing)
            return {
                "message": "Clocked in successfully",
                "time": now.isoformat(),
                "status": status,
                "location_status": location_status,
                "location_label": location_label,
                "location_name": location_name,
                "attendance_id": existing.id
            }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in clock_in: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clock in: {str(e)}")

@router.post("/clock-out")
def clock_out(
    latitude: Optional[float] = Query(None, description="Current latitude"),
    longitude: Optional[float] = Query(None, description="Current longitude"),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Clock out for the day."""
    try:
        today = date.today()
        
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()
        
        if not attendance:
            raise HTTPException(status_code=400, detail="No attendance record found for today")
        
        if not attendance.clock_in:
            raise HTTPException(status_code=400, detail="Not clocked in yet")
        
        if attendance.clock_out:
            raise HTTPException(status_code=400, detail="Already clocked out today")
        
        now = get_current_datetime()
        
        clock_in = attendance.clock_in
        if clock_in.tzinfo is None:
            clock_in = clock_in.replace(tzinfo=pytz.UTC)
        
        attendance.clock_out = now
        attendance.clock_out_latitude = latitude
        attendance.clock_out_longitude = longitude
        
        total_seconds = (now - clock_in).total_seconds()
        attendance.total_hours = total_seconds / 3600
        
        # Set status to "left" when clocking out
        attendance.status = "left"
        
        db.commit()
        db.refresh(attendance)
        
        return {
            "message": "Clocked out successfully",
            "total_hours": round(attendance.total_hours, 2),
            "status": attendance.status,
            "clock_out_time": now.isoformat(),
            "location_status": attendance.location_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in clock_out: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to clock out: {str(e)}")

@router.post("/break/start")
def start_break(
    break_type: str = Query(..., pattern="^(lunch|coffee|rest|other)$"),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Start a break."""
    try:
        today = date.today()
        
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()
        
        if not attendance or not attendance.clock_in:
            raise HTTPException(status_code=400, detail="Not clocked in yet")
        
        active_break = db.query(Break).filter(
            Break.attendance_id == attendance.id,
            Break.end_time.is_(None)
        ).first()
        
        if active_break:
            raise HTTPException(status_code=400, detail="Already on a break")
        
        db_break = Break(
            attendance_id=attendance.id,
            break_type=break_type,
            start_time=get_current_datetime(),
            tenant_id=tenant.id
        )
        
        db.add(db_break)
        db.commit()
        db.refresh(db_break)
        
        return {"message": "Break started", "break_id": db_break.id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in start_break: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start break: {str(e)}")

@router.post("/break/end")
def end_break(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """End the current break."""
    try:
        today = date.today()
        
        attendance = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()
        
        if not attendance:
            raise HTTPException(status_code=400, detail="No attendance record found")
        
        active_break = db.query(Break).filter(
            Break.attendance_id == attendance.id,
            Break.end_time.is_(None)
        ).first()
        
        if not active_break:
            raise HTTPException(status_code=400, detail="No active break")
        
        now = get_current_datetime()
        active_break.end_time = now
        
        start_time = active_break.start_time
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=pytz.UTC)
        
        duration_seconds = (now - start_time).total_seconds()
        active_break.duration = duration_seconds / 60
        
        db.commit()
        db.refresh(active_break)
        
        return {
            "message": "Break ended",
            "duration_minutes": round(active_break.duration, 2)
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in end_break: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to end break: {str(e)}")