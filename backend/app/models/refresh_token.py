from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class RefreshToken(Base):
    """
    Opaque, DB-backed refresh token. The access token (JWT) stays short-lived
    (30 min, stateless, unrevocable) - this is what actually lets a session be
    ended early: logout, password change, or admin action can flip `revoked`
    and the next /auth/refresh call fails immediately. Only a hash of the
    token is stored, same principle as password storage.
    """
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<RefreshToken user={self.user_id} revoked={self.revoked}>"
