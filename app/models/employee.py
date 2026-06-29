from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Employee(Base):
    __tablename__ = "employees"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String(20), nullable=False)
    first_name = Column(String(50), nullable=False)
    last_name = Column(String(50), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True, default='')
    department = Column(String(50), nullable=False)
    position = Column(String(50), nullable=False)
    joining_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    
    # Self-service fields
    profile_picture = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    marital_status = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(100), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    emergency_contact_relation = Column(String(50), nullable=True)
    bank_name = Column(String(100), nullable=True)
    bank_account = Column(String(50), nullable=True)
    bank_routing = Column(String(20), nullable=True)
    social_security = Column(String(20), nullable=True)
    # Use Text instead of JSON for simplicity
    skills = Column(Text, nullable=True, default='')
    certifications = Column(Text, nullable=True, default='')
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="employee")
    tenant = relationship("Tenant", back_populates="employees")
    assignments = relationship("Assignment", back_populates="employee", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="employee", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="employee", cascade="all, delete-orphan")
    leave_balances = relationship("LeaveBalance", back_populates="employee", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="employee", cascade="all, delete-orphan")
    timesheets = relationship("Timesheet", back_populates="employee", cascade="all, delete-orphan")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"
    
    def __repr__(self):
        return f"<Employee {self.employee_id} - {self.full_name}>"