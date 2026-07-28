from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List
from datetime import datetime, date
import re

class EmployeeBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    department: str = Field(..., min_length=2, max_length=50)
    position: str = Field(..., min_length=2, max_length=50)
    joining_date: date
    # Self-service fields - all optional
    profile_picture: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    marital_status: Optional[str] = Field(None, pattern="^(single|married|divorced|widowed)$")
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_routing: Optional[str] = None
    social_security: Optional[str] = None
    skills: Optional[str] = None  # Changed from List to String
    certifications: Optional[str] = None  # Changed from List to String


class EmployeeCreate(EmployeeBase):
    # Auto-generated server-side (see employees.py::_generate_employee_id) if
    # omitted - admins can still supply one explicitly to match an existing
    # numbering scheme.
    employee_id: Optional[str] = Field(None, min_length=3, max_length=20)
    user_id: Optional[int] = None
    seniority_level_id: Optional[int] = None
    # Designation to assign the auto-provisioned login (see
    # employees.py::_create_login_and_invite). Ignored if user_id is set,
    # since then no new login is created.
    role_id: Optional[int] = None


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    department: Optional[str] = Field(None, min_length=2, max_length=50)
    position: Optional[str] = Field(None, min_length=2, max_length=50)
    joining_date: Optional[date] = None
    is_active: Optional[bool] = None
    # Admin-only in practice - update_my_profile's field whitelist doesn't
    # include this, so self-service can't set it.
    seniority_level_id: Optional[int] = None
    # Self-service fields
    profile_picture: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    marital_status: Optional[str] = Field(None, pattern="^(single|married|divorced|widowed)$")
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_routing: Optional[str] = None
    social_security: Optional[str] = None
    skills: Optional[str] = None  # Changed from List to String
    certifications: Optional[str] = None  # Changed from List to String


class EmployeeResponse(EmployeeBase):
    id: int
    employee_id: str
    user_id: Optional[int] = None
    is_active: bool
    seniority_level_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Only ever populated on the create_employee response - a one-time
    # invite link for the new hire to set their password. Never
    # retrievable again afterwards (there's no getter for it).
    invite_link: Optional[str] = None

    class Config:
        from_attributes = True