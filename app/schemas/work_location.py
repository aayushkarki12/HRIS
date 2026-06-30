from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class WorkLocationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius: float = Field(100, gt=0, le=5000)
    is_active: bool = True


class WorkLocationCreate(WorkLocationBase):
    pass


class WorkLocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius: Optional[float] = Field(None, gt=0, le=5000)
    is_active: Optional[bool] = None


class WorkLocationResponse(WorkLocationBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
