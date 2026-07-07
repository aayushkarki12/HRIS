from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ResourceRequest(Base):
    __tablename__ = "resource_requests"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending/approved/rejected
    reason = Column(Text, nullable=True)
    admin_notes = Column(Text, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    resource = relationship("Resource", back_populates="requests")
    employee = relationship("Employee")
    tenant = relationship("Tenant")
