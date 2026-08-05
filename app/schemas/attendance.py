from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date

class BreakBase(BaseModel):
    break_type: str = Field(..., pattern="^(lunch|coffee|rest|other)$")


class BreakCreate(BreakBase):
    pass


class BreakResponse(BreakBase):
    id: int
    attendance_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: float = 0
    
    class Config:
        from_attributes = True


class AttendanceBase(BaseModel):
    date: date
    status: str = Field("present", pattern="^(present|absent|late|half-day|holiday|leave|left|not_clocked)$")  # Added 'left'


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(present|absent|late|half-day|holiday|leave|left|not_clocked)$")  # Added 'left'
    notes: Optional[str] = None
    is_approved: Optional[bool] = None


class LocationPingCreate(BaseModel):
    """One GPS fix reported by the mobile app.

    recorded_at is the device clock at fix time. The app queues fixes while
    offline and flushes them in a batch later, so this is the only usable
    "when was the employee here" - the server's receive time can be much
    later. was_queued tells the admin view which pings arrived late.
    """
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy: Optional[float] = Field(None, ge=0)
    battery_level: Optional[int] = Field(None, ge=0, le=100)
    recorded_at: datetime
    was_queued: bool = False


class LocationPingResponse(BaseModel):
    id: int
    employee_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    battery_level: Optional[int] = None
    location_status: str = "unknown"
    location_name: Optional[str] = None
    was_queued: bool = False
    recorded_at: datetime
    received_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EmployeeLiveLocation(BaseModel):
    """Latest known whereabouts of one employee, for the admin live view."""
    employee_id: int
    employee_name: str
    employee_code: Optional[str] = None
    device_status: str = Field(..., description="online | offline | no_data")
    minutes_since_last_ping: Optional[float] = None
    clocked_in: bool = False
    last_ping: Optional[LocationPingResponse] = None


class AttendanceResponse(AttendanceBase):
    id: int
    employee_id: int
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    total_hours: float = 0
    is_approved: bool = False
    notes: Optional[str] = None
    clock_in_latitude: Optional[float] = None
    clock_in_longitude: Optional[float] = None
    clock_out_latitude: Optional[float] = None
    clock_out_longitude: Optional[float] = None
    location_status: str = "unknown"
    work_location_id: Optional[int] = None
    location_name: Optional[str] = None
    breaks: List[BreakResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True