from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (
        UniqueConstraint("project_id", "employee_id", name="uq_project_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    role = Column(String(50), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="members")
    employee = relationship("Employee", back_populates="project_memberships")
    tenant = relationship("Tenant")
