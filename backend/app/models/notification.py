from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Notification(Base):
    """
    In-app notification for a single recipient user. Deliberately denormalized
    (entity_type/entity_id as plain strings, no FK) so it keeps working even
    if the source record is later deleted, same reasoning as AuditLog.
    """
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=True)  # e.g. "leave", "expense_claim"
    entity_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
    user = relationship("User")

    def __repr__(self):
        return f"<Notification user={self.user_id} read={self.is_read}>"
