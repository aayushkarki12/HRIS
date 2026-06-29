from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, Float, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class LeaveType(Base):
    __tablename__ = "leave_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    days_per_year = Column(Float, default=0)
    is_paid = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="leave_types")
    leaves = relationship("Leave", back_populates="leave_type")
    balances = relationship("LeaveBalance", back_populates="leave_type")
    
    def __repr__(self):
        return f"<LeaveType {self.code}>"


class Leave(Base):
    __tablename__ = "leaves"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="leaves")
    leave_type = relationship("LeaveType", back_populates="leaves")
    approver = relationship("User", foreign_keys=[approved_by])
    rejecter = relationship("User", foreign_keys=[rejected_by])
    canceller = relationship("User", foreign_keys=[cancelled_by])
    tenant = relationship("Tenant", back_populates="leaves")
    
    def __repr__(self):
        return f"<Leave {self.id} - {self.status}>"


class LeaveBalance(Base):
    __tablename__ = "leave_balances"
    
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"), nullable=False)
    year = Column(Integer, nullable=False)
    total_days = Column(Float, default=0)
    used_days = Column(Float, default=0)
    remaining_days = Column(Float, default=0)
    carried_over = Column(Float, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    employee = relationship("Employee", back_populates="leave_balances")
    leave_type = relationship("LeaveType", back_populates="balances")
    
    def __repr__(self):
        return f"<LeaveBalance {self.employee_id} - {self.leave_type_id} - {self.year}>"