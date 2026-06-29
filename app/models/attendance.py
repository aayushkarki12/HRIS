from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Attendance(Base):
    __tablename__ = "attendances"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    clock_in = Column(DateTime(timezone=True), nullable=True)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    total_hours = Column(Float, default=0)
    status = Column(String(20), default="present")
    is_approved = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Location tracking fields
    clock_in_latitude = Column(Float, nullable=True)
    clock_in_longitude = Column(Float, nullable=True)
    clock_out_latitude = Column(Float, nullable=True)
    clock_out_longitude = Column(Float, nullable=True)
    location_status = Column(String(20), default="unknown")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="attendances")
    tenant = relationship("Tenant", back_populates="attendances")
    breaks = relationship("Break", back_populates="attendance", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Attendance {self.employee_id} - {self.date}>"


class Break(Base):
    __tablename__ = "breaks"
    
    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendances.id"), nullable=False)
    break_type = Column(String(20), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    duration = Column(Float, default=0)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Location tracking for breaks
    start_latitude = Column(Float, nullable=True)
    start_longitude = Column(Float, nullable=True)
    end_latitude = Column(Float, nullable=True)
    end_longitude = Column(Float, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    attendance = relationship("Attendance", back_populates="breaks")
    tenant = relationship("Tenant", back_populates="breaks")
    
    def __repr__(self):
        return f"<Break {self.id} - {self.break_type}>"