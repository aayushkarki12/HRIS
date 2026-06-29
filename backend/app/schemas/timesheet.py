from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date

class TimesheetEntryBase(BaseModel):
    project_id: Optional[int] = None
    date: date
    hours: float = Field(..., gt=0, le=24)
    description: Optional[str] = None
    is_billable: bool = True


class TimesheetEntryCreate(TimesheetEntryBase):
    pass


class TimesheetEntryResponse(TimesheetEntryBase):
    id: int
    timesheet_id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TimesheetBase(BaseModel):
    week_start_date: date


class TimesheetCreate(TimesheetBase):
    @validator('week_start_date', pre=True)
    def validate_week_start(cls, v):
        if isinstance(v, str):
            # Try to parse the date
            from datetime import datetime
            try:
                return datetime.strptime(v, '%Y-%m-%d').date()
            except ValueError:
                raise ValueError('Invalid date format. Use YYYY-MM-DD')
        return v


class TimesheetResponse(TimesheetBase):
    id: int
    employee_id: int
    week_end_date: date
    total_hours: float
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    notes: Optional[str] = None
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    entries: Optional[List[TimesheetEntryResponse]] = []
    
    class Config:
        from_attributes = True