from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    assigned_date = Column(Date, nullable=False, server_default=func.now())
    return_date = Column(Date, nullable=True)
    status = Column(String(20), default="active", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - use string references
    employee = relationship("Employee", back_populates="assignments")
    resource = relationship("Resource", back_populates="assignments")
    project = relationship("Project", back_populates="assignments")
    tenant = relationship("Tenant", back_populates="assignments")
    projects = relationship("Project", secondary="assignment_projects", viewonly=False)
    
    def __repr__(self):
        return f"<Assignment {self.id}>"