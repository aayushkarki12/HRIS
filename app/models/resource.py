from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Resource(Base):
    __tablename__ = "resources"
    
    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), nullable=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    model = Column(String(100), nullable=True)
    serial_number = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), default="available", nullable=False)
    assigned_to = Column(Integer, ForeignKey("employees.id"), nullable=True)
    purchase_date = Column(Date, nullable=True)
    warranty_until = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    assignments = relationship("Assignment", back_populates="resource")
    
    def __repr__(self):
        return f"<Resource {self.asset_tag} - {self.name}>"