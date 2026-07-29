from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)


class DepartmentUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)


class DepartmentResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    employee_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
