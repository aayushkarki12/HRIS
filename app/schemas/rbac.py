from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PermissionResponse(BaseModel):
    key: str
    category: str
    description: str

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = None
    permission_keys: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    description: Optional[str] = None
    permission_keys: Optional[List[str]] = None


class RoleResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    is_system: bool
    permission_keys: List[str] = []
    user_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SeniorityLevelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    rank: int = Field(..., ge=0)


class SeniorityLevelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    rank: Optional[int] = Field(None, ge=0)


class SeniorityLevelResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    rank: int
    employee_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalLimitCreate(BaseModel):
    role_id: Optional[int] = None
    seniority_level_id: Optional[int] = None
    permission_key: str
    max_amount: float = Field(..., gt=0)


class ApprovalLimitUpdate(BaseModel):
    max_amount: float = Field(..., gt=0)


class ApprovalLimitResponse(BaseModel):
    id: int
    tenant_id: int
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    seniority_level_id: Optional[int] = None
    seniority_level_name: Optional[str] = None
    permission_key: str
    max_amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
