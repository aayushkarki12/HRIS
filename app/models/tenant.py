from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    subdomain = Column(String(50), nullable=False, unique=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    logo_url = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Office location fields
    office_latitude = Column(Float, nullable=True)
    office_longitude = Column(Float, nullable=True)
    office_radius = Column(Float, default=100)
    office_address = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    employees = relationship("Employee", back_populates="tenant", cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="tenant", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="tenant", cascade="all, delete-orphan")
    assignments = relationship("Assignment", back_populates="tenant", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="tenant", cascade="all, delete-orphan")
    leave_types = relationship("LeaveType", back_populates="tenant", cascade="all, delete-orphan")
    leaves = relationship("Leave", back_populates="tenant", cascade="all, delete-orphan")
    attendances = relationship("Attendance", back_populates="tenant", cascade="all, delete-orphan")
    work_locations = relationship("WorkLocation", back_populates="tenant", cascade="all, delete-orphan")
    breaks = relationship("Break", back_populates="tenant", cascade="all, delete-orphan")
    timesheets = relationship("Timesheet", back_populates="tenant", cascade="all, delete-orphan")
    timesheet_entries = relationship("TimesheetEntry", back_populates="tenant", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="tenant", cascade="all, delete-orphan")
    journal_entries = relationship("JournalEntry", back_populates="tenant", cascade="all, delete-orphan")
    journal_entry_lines = relationship("JournalEntryLine", back_populates="tenant", cascade="all, delete-orphan")
    salary_structures = relationship("SalaryStructure", back_populates="tenant", cascade="all, delete-orphan")
    payroll_runs = relationship("PayrollRun", back_populates="tenant", cascade="all, delete-orphan")
    payslips = relationship("Payslip", back_populates="tenant", cascade="all, delete-orphan")
    payslip_lines = relationship("PayslipLine", back_populates="tenant", cascade="all, delete-orphan")
    expense_claims = relationship("ExpenseClaim", back_populates="tenant", cascade="all, delete-orphan")
    expense_claim_lines = relationship("ExpenseClaimLine", back_populates="tenant", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="tenant", cascade="all, delete-orphan")
    invoice_lines = relationship("InvoiceLine", back_populates="tenant", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="tenant", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Tenant {self.name}>"