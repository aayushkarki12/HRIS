from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=10, max_length=500)
    status: str = Field("active", pattern="^(active|completed|on-hold|planning|cancelled)$")
    start_date: date
    end_date: Optional[date] = None
    budget: float = Field(..., ge=0)
    progress: int = Field(0, ge=0, le=100)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, min_length=10, max_length=500)
    status: Optional[str] = Field(None, pattern="^(active|completed|on-hold|planning|cancelled)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = Field(None, ge=0)
    progress: Optional[int] = Field(None, ge=0, le=100)


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MemberEmployeeInfo(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    department: str
    position: str

    class Config:
        from_attributes = True


class ProjectMemberCreate(BaseModel):
    employee_id: int
    role: Optional[str] = Field(None, max_length=50)


class ProjectMemberResponse(BaseModel):
    id: int
    project_id: int
    employee_id: int
    role: Optional[str] = None
    created_at: datetime
    employee: Optional[MemberEmployeeInfo] = None

    class Config:
        from_attributes = True