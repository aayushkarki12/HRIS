from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional
from datetime import datetime

class TenantBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    subdomain: str = Field(..., min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = None
    logo_url: Optional[str] = None
    # Office location fields
    office_latitude: Optional[float] = None
    office_longitude: Optional[float] = None
    office_radius: Optional[float] = Field(100, ge=0)
    office_address: Optional[str] = None


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    subdomain: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    address: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    # Office location fields
    office_latitude: Optional[float] = None
    office_longitude: Optional[float] = None
    office_radius: Optional[int] = Field(100, ge=0)  # This expects an integer!
    office_address: Optional[str] = None


class TenantResponse(TenantBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True