from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime, date
import re

class EmployeeBase(BaseModel):
    """Base schema for Employee with common fields"""
    employee_id: str = Field(..., min_length=3, max_length=20, description="Unique employee identifier")
    first_name: str = Field(..., min_length=1, max_length=50, description="Employee's first name")
    last_name: str = Field(..., min_length=1, max_length=50, description="Employee's last name")
    email: EmailStr = Field(..., description="Employee's email address")
    phone: Optional[str] = Field(None, min_length=10, max_length=20, description="Employee's phone number")
    department: str = Field(..., min_length=2, max_length=50, description="Department name")
    position: str = Field(..., min_length=2, max_length=50, description="Job position")
    joining_date: date = Field(..., description="Date when employee joined")  # Changed from join_date


class EmployeeCreate(EmployeeBase):
    """Schema for creating a new employee"""
    user_id: int = Field(..., description="User ID to link with employee")


class EmployeeUpdate(BaseModel):
    """Schema for updating an existing employee"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    department: Optional[str] = Field(None, min_length=2, max_length=50)
    position: Optional[str] = Field(None, min_length=2, max_length=50)
    joining_date: Optional[date] = None  # Changed from join_date
    is_active: Optional[bool] = None


class EmployeeResponse(EmployeeBase):
    """Schema for employee response with all fields"""
    id: int = Field(..., description="Internal employee ID")
    user_id: int = Field(..., description="Linked user ID")
    is_active: bool = Field(True, description="Employee active status")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "employee_id": "EMP0001",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "phone": "1234567890",
                "department": "Engineering",
                "position": "Senior Developer",
                "joining_date": "2024-01-15",  # Changed from join_date
                "is_active": True,
                "user_id": 1,
                "created_at": "2024-01-15T10:00:00",
                "updated_at": "2024-01-15T10:00:00"
            }
        }


class EmployeeListResponse(BaseModel):
    """Schema for paginated employee list response"""
    items: list[EmployeeResponse]
    total: int = Field(..., description="Total number of employees")
    skip: int = Field(0, description="Number of items skipped")
    limit: int = Field(100, description="Number of items per page")
    
    class Config:
        from_attributes = True


class EmployeeDepartmentStats(BaseModel):
    """Schema for department statistics"""
    department: str = Field(..., description="Department name")
    count: int = Field(0, description="Number of employees in department")
    active_count: int = Field(0, description="Number of active employees in department")
    
    class Config:
        from_attributes = True