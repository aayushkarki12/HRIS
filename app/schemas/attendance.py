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