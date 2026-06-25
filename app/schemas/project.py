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


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, min_length=10, max_length=500)
    status: Optional[str] = Field(None, pattern="^(active|completed|on-hold|planning|cancelled)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = Field(None, ge=0)


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True