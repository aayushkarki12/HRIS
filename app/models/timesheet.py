from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Timesheet(Base):
    __tablename__ = "timesheets"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    week_start_date = Column(Date, nullable=False)
    week_end_date = Column(Date, nullable=False)
    total_hours = Column(Float, default=0)
    status = Column(String(20), default="draft")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="timesheets")
    entries = relationship("TimesheetEntry", back_populates="timesheet", cascade="all, delete-orphan")
    approver = relationship("User", foreign_keys=[approved_by])
    tenant = relationship("Tenant", back_populates="timesheets")
    
    def __repr__(self):
        return f"<Timesheet {self.id} - Week {self.week_start_date}>"


class TimesheetEntry(Base):
    __tablename__ = "timesheet_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    timesheet_id = Column(Integer, ForeignKey("timesheets.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    description = Column(Text, nullable=True)
    is_billable = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    timesheet = relationship("Timesheet", back_populates="entries")
    project = relationship("Project")
    tenant = relationship("Tenant", back_populates="timesheet_entries")
    
    def __repr__(self):
        return f"<TimesheetEntry {self.id} - {self.date} - {self.hours}h>"