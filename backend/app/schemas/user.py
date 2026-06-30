from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime, date

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    
    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.isalnum():
            raise ValueError('Username must be alphanumeric')
        return v


class UserCreate(UserBase):
    """
    Schema for self-registration. Deliberately has NO `role` field - the
    register endpoint always assigns role="user" regardless of what's sent,
    but keeping `role` out of this schema entirely means there's nothing for
    a future code change to accidentally start honoring. Promoting someone to
    manager/admin is only possible via PUT /users/{id} by an existing admin.
    """
    password: str = Field(..., min_length=8, max_length=100)
    phone: Optional[str] = Field(None, min_length=10, max_length=20)
    department: str = Field("General", min_length=2, max_length=50)
    position: str = Field("Staff", min_length=2, max_length=50)
    join_date: Optional[date] = None
    tenant_subdomain: str = Field("default", min_length=2, max_length=50)

    @validator('password')
    def password_strength(cls, v):
        from ..core.security import validate_password_strength
        error = validate_password_strength(v)
        if error:
            raise ValueError(error)
        return v


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(admin|manager|user)$")
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TenantInfo(BaseModel):
    id: int
    name: str
    subdomain: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    office_latitude: Optional[float] = None
    office_longitude: Optional[float] = None
    office_radius: Optional[float] = None
    office_address: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse
    tenant: Optional[TenantInfo] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class AccessTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None
    tenant_id: Optional[int] = None