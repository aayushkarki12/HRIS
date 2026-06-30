from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class PasswordResetToken(Base):
    """
    Opaque, DB-backed password reset token sent via email. Short-lived (1
    hour) and single-use - `used` flips to True the moment it's redeemed,
    same as `revoked` on RefreshToken, so a leaked/forwarded email link
    can't be replayed. Only a hash of the token is stored.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<PasswordResetToken user={self.user_id} used={self.used}>"
