import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime, timedelta
import pytz

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant, get_current_employee
from ...core.permissions import user_has_permission
from ...core.location import get_location_status
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.attendance import Attendance, WorkLocation
from ...models.location_ping import LocationPing
from ...schemas.attendance import (
    AttendanceResponse,
    LocationPingCreate,
    LocationPingResponse,
    EmployeeLiveLocation,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["attendance"])

# How late a "fixed" employee can clock in past their fixed_clock_in_time
# before it's tagged "late" - a policy judgment call, not a legal minimum.
LATE_GRACE_MINUTES = 15

# A device that hasn't reported in this long is shown as offline. The app
# pings every ~15 minutes, so this is two missed intervals plus slack -
# tight enough to notice a dead device, loose enough not to flag every
# tunnel and elevator.
OFFLINE_AFTER_MINUTES = 35

# Cap on one flushed offline batch. A phone that was dark for a week could
# otherwise post thousands of rows in a single unbounded request.
MAX_PINGS_PER_BATCH = 200

def get_current_datetime():
    """Get current datetime with timezone."""
    return datetime.now(pytz.UTC)


def _determine_status(employee: Employee, clock_in_time: datetime) -> str:
    """
    Attendance status is now derived per-employee instead of one global
    time-of-day cutoff for everyone:
      - "fixed" with a configured fixed_clock_in_time: on-time (within
        LATE_GRACE_MINUTES) -> "present", otherwise "late".
      - Everyone else (fixed with no configured time, "individual",
        "contractor"): just "present" - no automatic status judgment, since
        there's no schedule to be late against.
    """
    if employee.attendance_type == "fixed" and employee.fixed_clock_in_time:
        local_time = clock_in_time.astimezone(pytz.timezone('Asia/Kathmandu'))
        try:
            fixed_hour, fixed_minute = (int(p) for p in employee.fixed_clock_in_time.split(":"))
        except (ValueError, AttributeError):
            return "present"
        scheduled = local_time.replace(hour=fixed_hour, minute=fixed_minute, second=0, microsecond=0)
        if local_time <= scheduled + timedelta(minutes=LATE_GRACE_MINUTES):
            return "present"
        return "late"
    return "present"


def _location_status_for(
    employee: Employee, tenant: Tenant, db: Session, latitude: Optional[float], longitude: Optional[float]
):
    """
    Where the employee is clocking in from, scoped to what's relevant for
    their attendance_type:
      - "fixed" with an assigned site: checked against just that one site
        (soft-enforced - an off-site punch is tagged, not rejected, since
        the enforcement strictness the admin actually wants wasn't
        explicitly pinned down; flip this to a hard 400 if that's needed).
      - everyone else: checked against every active work location, purely
        informational (matches the previous tenant-wide behavior).
    Returns (location_status, location_label, work_location_id, location_name).
    """
    if not (latitude and longitude):
        return "unknown", "Location not provided", None, None

    if employee.attendance_type == "fixed" and employee.assigned_work_location_id:
        assigned = db.query(WorkLocation).filter(
            WorkLocation.id == employee.assigned_work_location_id,
            WorkLocation.tenant_id == tenant.id,
        ).first()
        work_locations = [assigned] if assigned else []
    else:
        work_locations = db.query(WorkLocation).filter(
            WorkLocation.tenant_id == tenant.id,
            WorkLocation.is_active == True
        ).all()

    return get_location_status(latitude, longitude, tenant, work_locations)


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

        if current_user.role not in ["admin", "manager"] and not user_has_permission(db, current_user, "attendance.manage"):
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

@router.get("/today-overview", response_model=dict)
def get_today_attendance_overview(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Tenant-wide snapshot of who's clocked in today (admin/manager only). Used
    to power the "today's attendance" KPI on the admin dashboard, including
    the clickable "who's online" drill-down and the "has a shift but hasn't
    clocked in" list.
    """
    if current_user.role not in ["admin", "manager"] and not user_has_permission(db, current_user, "attendance.manage"):
        raise HTTPException(status_code=403, detail="Not authorized to view tenant-wide attendance")

    today = date.today()
    active_employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.is_active == True
    ).all()
    total_active_employees = len(active_employees)

    today_records = db.query(Attendance).filter(
        Attendance.tenant_id == tenant.id,
        Attendance.date == today
    ).all()
    attendance_by_employee = {att.employee_id: att for att in today_records}

    status_counts = {"present": 0, "late": 0, "half-day": 0, "leave": 0, "holiday": 0}
    for att in today_records:
        if att.status in status_counts:
            status_counts[att.status] += 1

    checked_in = sum(1 for att in today_records if att.clock_in)
    absent = max(total_active_employees - len(today_records), 0)

    def _employee_summary(emp: Employee, att: Optional[Attendance] = None) -> dict:
        return {
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name}",
            "department": emp.department,
            "position": emp.position,
            "attendance_type": emp.attendance_type,
            "clock_in": att.clock_in.isoformat() if att and att.clock_in else None,
            "location_status": att.location_status if att else None,
            "fixed_clock_in_time": emp.fixed_clock_in_time,
        }

    # Who's currently clocked in - for the "online now" drill-down. Includes
    # every attendance_type (fixed/individual/contractor).
    checked_in_employees = [
        _employee_summary(emp, attendance_by_employee.get(emp.id))
        for emp in active_employees
        if attendance_by_employee.get(emp.id) and attendance_by_employee[emp.id].clock_in and not attendance_by_employee[emp.id].clock_out
    ]

    # Employees with a fixed shift (fixed_clock_in_time configured) who
    # haven't clocked in yet today - shift is optional, only "fixed"
    # attendance_type employees who actually have one set are considered.
    missed_shift_employees = [
        _employee_summary(emp, attendance_by_employee.get(emp.id))
        for emp in active_employees
        if emp.attendance_type == "fixed" and emp.fixed_clock_in_time
        and not (attendance_by_employee.get(emp.id) and attendance_by_employee[emp.id].clock_in)
    ]

    return {
        "total_active_employees": total_active_employees,
        "checked_in": checked_in,
        "absent": absent,
        "status_counts": status_counts,
        "checked_in_employees": checked_in_employees,
        "missed_shift_employees": missed_shift_employees,
    }

@router.post("/clock-in")
def clock_in(
    latitude: Optional[float] = Query(None, description="Current latitude"),
    longitude: Optional[float] = Query(None, description="Current longitude"),
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Clock in for the day. Rules vary by the employee's attendance_type -
    see _location_status_for and _determine_status."""
    try:
        today = date.today()

        existing = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()

        if existing and existing.clock_in:
            raise HTTPException(status_code=400, detail="Already clocked in today")

        now = get_current_datetime()

        location_status, location_label, work_location_id, location_name = _location_status_for(
            current_employee, tenant, db, latitude, longitude
        )
        attendance_status = _determine_status(current_employee, now)

        if not existing:
            attendance = Attendance(
                employee_id=current_employee.id,
                date=today,
                clock_in=now,
                status=attendance_status,
                tenant_id=tenant.id,
                clock_in_latitude=latitude,
                clock_in_longitude=longitude,
                location_status=location_status,
                work_location_id=work_location_id,
                location_name=location_name
            )
            db.add(attendance)
            db.flush()
            record_audit_log(db, tenant.id, current_employee.user_id, "check_in", "attendance", attendance.id,
                              f"{current_employee.first_name} {current_employee.last_name} checked in")
            db.commit()
            db.refresh(attendance)
            return {
                "message": "Clocked in successfully",
                "time": now.isoformat(),
                "status": attendance_status,
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
            existing.status = attendance_status
            record_audit_log(db, tenant.id, current_employee.user_id, "check_in", "attendance", existing.id,
                              f"{current_employee.first_name} {current_employee.last_name} checked in")
            db.commit()
            db.refresh(existing)
            return {
                "message": "Clocked in successfully",
                "time": now.isoformat(),
                "status": attendance_status,
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
    """Clock out for the day.

    Contractors can clock in/out freeform, including across a day boundary
    (e.g. clock in at 11pm, clock out at 7am) - if there's no open record for
    *today*, we fall back to yesterday's still-open record instead of
    failing. Fixed/individual employees stay same-day only, matching the
    previous behavior."""
    try:
        today = date.today()

        attendance = db.query(Attendance).filter(
            Attendance.employee_id == current_employee.id,
            Attendance.date == today
        ).first()

        if (not attendance or not attendance.clock_in or attendance.clock_out) and current_employee.attendance_type == "contractor":
            yesterday_open = db.query(Attendance).filter(
                Attendance.employee_id == current_employee.id,
                Attendance.date == today - timedelta(days=1),
                Attendance.clock_in.isnot(None),
                Attendance.clock_out.is_(None),
            ).first()
            if yesterday_open:
                attendance = yesterday_open

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


@router.post("/location-ping", status_code=status.HTTP_201_CREATED)
def submit_location_pings(
    pings: List[LocationPingCreate],
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Periodic whereabouts report from the mobile app.

    Takes a batch rather than a single fix because the app keeps recording
    while the device is offline and flushes the queue once connectivity is
    back - each queued fix carries its own recorded_at and was_queued=True,
    so a late arrival is still placed at the time it actually happened.

    Each fix is resolved against the employee's assigned work location (or,
    for non-fixed employees, every active site) using exactly the same
    geofence logic as clock-in, so the admin view never re-derives it.
    """
    if not pings:
        return {"accepted": 0}

    if len(pings) > MAX_PINGS_PER_BATCH:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"At most {MAX_PINGS_PER_BATCH} pings per request",
        )

    now = get_current_datetime()
    accepted = 0
    for ping in pings:
        recorded_at = ping.recorded_at
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=pytz.UTC)
        # A device clock can be wrong or deliberately set forward; clamp
        # future timestamps to now so one bad phone can't park a ping at the
        # top of the "latest" ordering forever.
        if recorded_at > now:
            recorded_at = now

        location_status, _label, _wl_id, location_name = _location_status_for(
            current_employee, tenant, db, ping.latitude, ping.longitude
        )
        db.add(LocationPing(
            employee_id=current_employee.id,
            tenant_id=tenant.id,
            latitude=ping.latitude,
            longitude=ping.longitude,
            accuracy=ping.accuracy,
            battery_level=ping.battery_level,
            location_status=location_status,
            location_name=location_name,
            was_queued=ping.was_queued,
            recorded_at=recorded_at,
        ))
        accepted += 1

    db.commit()
    return {"accepted": accepted, "server_time": now.isoformat()}


@router.get("/live-locations", response_model=List[EmployeeLiveLocation])
def get_live_locations(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Where every active employee was last seen (admin/manager only).

    device_status is derived from ping age rather than stored: a phone that
    loses connectivity, is switched off, or has the app killed simply stops
    reporting, so "offline" is the absence of recent pings. no_data means
    the employee has never reported - typically the app isn't installed.
    """
    if current_user.role not in ["admin", "manager"] and not user_has_permission(db, current_user, "attendance.manage"):
        raise HTTPException(status_code=403, detail="Not authorized to view employee locations")

    employees = db.query(Employee).filter(
        Employee.tenant_id == tenant.id,
        Employee.is_active == True
    ).all()
    if not employees:
        return []

    employee_ids = [e.id for e in employees]
    now = get_current_datetime()

    # One query for the whole tenant, then pick the newest ping per employee
    # in Python. Postgres DISTINCT ON would be tighter, but this endpoint is
    # bounded by (employees x pings-in-window), not by the full history.
    window_start = now - timedelta(hours=24)
    recent_pings = db.query(LocationPing).filter(
        LocationPing.tenant_id == tenant.id,
        LocationPing.employee_id.in_(employee_ids),
        LocationPing.recorded_at >= window_start,
    ).order_by(LocationPing.recorded_at.desc()).all()

    latest_by_employee = {}
    for ping in recent_pings:
        latest_by_employee.setdefault(ping.employee_id, ping)

    today = date.today()
    clocked_in_ids = {
        row.employee_id for row in db.query(Attendance).filter(
            Attendance.tenant_id == tenant.id,
            Attendance.date == today,
            Attendance.clock_in.isnot(None),
        ).all()
    }

    results = []
    for employee in employees:
        ping = latest_by_employee.get(employee.id)
        if ping is None:
            device_status, minutes = "no_data", None
        else:
            recorded_at = ping.recorded_at
            if recorded_at.tzinfo is None:
                recorded_at = recorded_at.replace(tzinfo=pytz.UTC)
            minutes = (now - recorded_at).total_seconds() / 60
            device_status = "online" if minutes <= OFFLINE_AFTER_MINUTES else "offline"

        results.append(EmployeeLiveLocation(
            employee_id=employee.id,
            employee_name=f"{employee.first_name} {employee.last_name}".strip(),
            employee_code=employee.employee_id,
            device_status=device_status,
            minutes_since_last_ping=round(minutes, 1) if minutes is not None else None,
            clocked_in=employee.id in clocked_in_ids,
            last_ping=LocationPingResponse.model_validate(ping) if ping else None,
        ))

    # Most interesting first: people whose device has gone dark.
    order = {"offline": 0, "online": 1, "no_data": 2}
    results.sort(key=lambda r: (order[r.device_status], r.employee_name))
    return results


@router.get("/location-history/{employee_id}", response_model=List[LocationPingResponse])
def get_location_history(
    employee_id: int,
    start: Optional[datetime] = Query(None, description="Only pings recorded at/after this time"),
    end: Optional[datetime] = Query(None, description="Only pings recorded at/before this time"),
    limit: int = Query(500, le=2000),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Ping trail for one employee. Admins/managers can read anyone in the
    tenant; everyone else only their own record."""
    employee = db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    is_manager = current_user.role in ["admin", "manager"] or user_has_permission(db, current_user, "attendance.manage")
    if not is_manager and employee.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this employee's location history")

    query = db.query(LocationPing).filter(
        LocationPing.tenant_id == tenant.id,
        LocationPing.employee_id == employee_id,
    )
    if start:
        query = query.filter(LocationPing.recorded_at >= start)
    if end:
        query = query.filter(LocationPing.recorded_at <= end)

    return query.order_by(LocationPing.recorded_at.desc()).limit(limit).all()
