from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
import pytz
from ..core.database import SessionLocal
from ..models.attendance import Attendance
from ..models.employee import Employee

def mark_absent_employees():
    """
    Mark employees as absent if they haven't clocked in by end of day.
    This should be run as a scheduled task (e.g., via cron or celery).
    """
    db = SessionLocal()
    try:
        today = date.today()
        
        # Get all active employees
        employees = db.query(Employee).filter(Employee.is_active == True).all()
        
        for employee in employees:
            # Check if attendance record exists for today
            attendance = db.query(Attendance).filter(
                Attendance.employee_id == employee.id,
                Attendance.date == today
            ).first()
            
            if not attendance:
                # No attendance record - mark as absent
                new_attendance = Attendance(
                    employee_id=employee.id,
                    date=today,
                    status="absent",
                    tenant_id=employee.tenant_id
                )
                db.add(new_attendance)
            elif not attendance.clock_in and attendance.status != "absent":
                # Has record but no clock-in - mark as absent
                attendance.status = "absent"
        
        db.commit()
        print(f"✅ Marked absent employees for {today}")
    except Exception as e:
        print(f"❌ Error marking absent employees: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    mark_absent_employees()