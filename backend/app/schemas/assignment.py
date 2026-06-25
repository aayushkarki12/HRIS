from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date

# Simple response schemas for nested objects
class SimpleEmployeeResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    department: str
    position: str
    
    class Config:
        from_attributes = True

class SimpleResourceResponse(BaseModel):
    id: int
    name: str
    type: str
    serial_number: str
    status: str
    
    class Config:
        from_attributes = True

class SimpleProjectResponse(BaseModel):
    id: int
    name: str
    status: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True

class AssignmentBase(BaseModel):
    employee_id: int = Field(..., description="ID of the employee being assigned")
    resource_id: int = Field(..., description="ID of the resource being assigned")
    project_id: int = Field(..., description="ID of the project")
    assigned_date: Optional[date] = Field(None, description="Date when resource was assigned")


class AssignmentCreate(AssignmentBase):
    pass


class AssignmentUpdate(BaseModel):
    return_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(active|returned|overdue)$")


class AssignmentResponse(BaseModel):
    id: int
    employee_id: int
    resource_id: int
    project_id: int
    assigned_date: date
    return_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    employee: Optional[SimpleEmployeeResponse] = None
    resource: Optional[SimpleResourceResponse] = None
    project: Optional[SimpleProjectResponse] = None
    
    class Config:
        from_attributes = True