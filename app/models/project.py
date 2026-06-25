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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    assignments = relationship("Assignment", back_populates="project")
    
    def __repr__(self):
        return f"<Project {self.name}>"