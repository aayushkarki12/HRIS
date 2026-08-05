from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(50), nullable=True, default='')
    last_name = Column(String(50), nullable=True, default='')
    # Legacy coarse role - still the source of truth for existing
    # get_current_admin_user/get_current_manager_user checks during the RBAC
    # rollout. New code should prefer role_id -> Role -> RolePermission.
    role = Column(String(20), default="user", nullable=False)
    # New RBAC: an admin-managed, named role/designation (CEO, Accountant, ...)
    # carrying a permission set. Nullable during rollout - not every user has
    # been assigned one yet; falls back to the legacy `role` string until set.
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    # E.164 format (e.g. "+15551234567"). Nullable so existing accounts
    # aren't broken by this migration - only collected/verified going forward
    # via the invite-acceptance flow (self-registration was removed). See
    # phone_verified and app/core/firebase.py.
    phone = Column(String(20), unique=True, nullable=True, index=True)
    # True once the user has completed Firebase phone OTP verification once
    # (not re-checked on every login - see POST /auth/verify-phone and
    # POST /auth/login).
    phone_verified = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships - use string references
    tenant = relationship("Tenant", back_populates="users")
    employee = relationship("Employee", back_populates="user", uselist=False, cascade="all, delete-orphan")
    rbac_role = relationship("Role", foreign_keys=[role_id])
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username
    
    def __repr__(self):
        return f"<User {self.username}>"