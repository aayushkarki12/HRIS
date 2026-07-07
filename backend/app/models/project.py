from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="active", nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    budget = Column(Float, nullable=True)
    progress = Column(Integer, default=0, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships - use string references
    tenant = relationship("Tenant", back_populates="projects")
    assignments = relationship("Assignment", back_populates="project")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project {self.name}>"