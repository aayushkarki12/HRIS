from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class SalaryStructure(Base):
    __tablename__ = "salary_structures"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    base_salary = Column(Float, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    effective_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", backref="salary_structures")
    tenant = relationship("Tenant", back_populates="salary_structures")

    def __repr__(self):
        return f"<SalaryStructure {self.employee_id} - {self.base_salary}>"


class PayrollRun(Base):
    __tablename__ = "payroll_runs"

    id = Column(Integer, primary_key=True, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    status = Column(String(20), default="draft", nullable=False)
    processed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    total_gross = Column(Float, default=0)
    total_deductions = Column(Float, default=0)
    total_net = Column(Float, default=0)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="payroll_runs")
    processor = relationship("User", foreign_keys=[processed_by])
    journal_entry = relationship("JournalEntry")
    payslips = relationship("Payslip", back_populates="payroll_run", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<PayrollRun {self.period_start} - {self.period_end}>"


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(Integer, primary_key=True, index=True)
    payroll_run_id = Column(Integer, ForeignKey("payroll_runs.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    base_salary = Column(Float, default=0)
    gross_salary = Column(Float, default=0)
    total_deductions = Column(Float, default=0)
    net_salary = Column(Float, default=0)
    working_days = Column(Float, default=0)
    leave_days = Column(Float, default=0)
    overtime_hours = Column(Float, default=0)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    payroll_run = relationship("PayrollRun", back_populates="payslips")
    employee = relationship("Employee", backref="payslips")
    tenant = relationship("Tenant", back_populates="payslips")
    lines = relationship("PayslipLine", back_populates="payslip", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Payslip {self.employee_id} - Net: {self.net_salary}>"


class PayslipLine(Base):
    __tablename__ = "payslip_lines"

    id = Column(Integer, primary_key=True, index=True)
    payslip_id = Column(Integer, ForeignKey("payslips.id"), nullable=False)
    line_type = Column(String(20), nullable=False)
    description = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    payslip = relationship("Payslip", back_populates="lines")
    tenant = relationship("Tenant", back_populates="payslip_lines")

    def __repr__(self):
        return f"<PayslipLine {self.line_type} - {self.amount}>"
