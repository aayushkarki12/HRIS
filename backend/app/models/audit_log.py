from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class AuditLog(Base):
    """
    Generic, append-only record of who did what to which record and when.
    Deliberately denormalized (no FK to the target row, just type+id as
    strings) so it keeps working even after the target row is deleted, and so
    one helper can log against any table without per-entity wiring.
    """
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(50), nullable=False)  # e.g. "create", "approve", "reject", "deactivate", "post"
    entity_type = Column(String(50), nullable=False)  # e.g. "leave", "journal_entry", "salary_structure"
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)  # short human-readable note, not a full diff
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6; null for entries logged without a request
    user_agent = Column(String(255), nullable=True)
    severity = Column(String(20), nullable=False, server_default="info")  # info | warning | critical
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
    user = relationship("User")

    def __repr__(self):
        return f"<AuditLog {self.action} {self.entity_type}:{self.entity_id}>"
