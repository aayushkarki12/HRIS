from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime, date

class LeaveTypeBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    code: str = Field(..., min_length=2, max_length=20)
    description: Optional[str] = None
    days_per_year: float = Field(0, ge=0)
    is_paid: bool = True
    is_active: bool = True


class LeaveTypeCreate(LeaveTypeBase):
    pass


class LeaveTypeResponse(LeaveTypeBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class LeaveBase(BaseModel):
    leave_type_id: int
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveCreate(LeaveBase):
    @validator('end_date')
    def validate_dates(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after start date')
        return v


class LeaveUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|approved|rejected|cancelled)$")
    reason: Optional[str] = None


class LeaveResponse(LeaveBase):
    id: int
    employee_id: int
    total_days: float
    status: str
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejected_by: Optional[int] = None
    rejected_at: Optional[datetime] = None
    cancelled_by: Optional[int] = None
    cancelled_at: Optional[datetime] = None
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    leave_type: Optional[LeaveTypeResponse] = None
    
    class Config:
        from_attributes = True


class LeaveBalanceResponse(BaseModel):
    id: int
    employee_id: int
    leave_type_id: int
    year: int
    total_days: float
    used_days: float
    remaining_days: float
    carried_over: float
    leave_type: Optional[LeaveTypeResponse] = None
    
    class Config:
        from_attributes = True