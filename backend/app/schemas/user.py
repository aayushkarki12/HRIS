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


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[str] = Field(None, pattern="^(admin|manager|user)$")
    # New RBAC role/designation (see app/models/rbac.py) - separate from the
    # legacy `role` string above, which stays in place during the rollout.
    role_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    first_name: str
    last_name: str
    role: str
    role_id: Optional[int] = None
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


class AdminResetPasswordRequest(BaseModel):
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: str
    tenant_subdomain: str = "default"


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class InvitationDetails(BaseModel):
    """Read-only profile info shown on the accept-invitation page - the new
    hire can only choose a username and password, everything else here was
    set by whoever added them as an employee."""
    first_name: str
    last_name: str
    email: str
    employee_id: str
    department: str
    position: str
    designation: Optional[str] = None
    seniority_level: Optional[str] = None
    joining_date: Optional[date] = None
    tenant_name: str
    username_suggestion: str
    # Pre-filled from Employee.phone (collected by the admin at employee-
    # creation time) as a starting point - the new hire still has to verify
    # it themselves via Firebase OTP, this is just a suggestion.
    phone_suggestion: Optional[str] = None


class AcceptInvitationRequest(BaseModel):
    token: str
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=100)

    @validator('username')
    def username_alphanumeric(cls, v):
        if not v.isalnum():
            raise ValueError('Username must be alphanumeric')
        return v


class VerifyPhoneRequest(BaseModel):
    """Body for POST /auth/verify-phone - the frontend completes the actual
    OTP send/check with Firebase's client SDK and hands us the resulting ID
    token to verify server-side (see app/core/firebase.py)."""
    token: str
    id_token: str


class TokenData(BaseModel):
    user_id: Optional[int] = None
    role: Optional[str] = None
    tenant_id: Optional[int] = None