from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Budget(Base):
    """
    A budget header for one scope (company-wide, a cost center, a project, or
    an employee) over one fiscal year, broken into period lines (annual,
    quarterly, or monthly) held in BudgetPeriod. Actuals are never stored here -
    they're computed on read from the existing ledger/expense-claim/invoice
    data for the matching scope and date range, so there is exactly one source
    of truth for what was actually spent or earned.
    """
    __tablename__ = "budgets"
    __table_args__ = (
        Index("ix_budgets_tenant_scope", "tenant_id", "scope_type", "scope_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(150), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    period_type = Column(String(10), nullable=False)  # annual | quarterly | monthly
    scope_type = Column(String(20), nullable=False)  # company | cost_center | project | employee
    scope_id = Column(Integer, nullable=True)  # id of CostCenter/Project/Employee; null for company
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # optional: narrow to one ledger account
    status = Column(String(20), nullable=False, default="draft")  # draft | submitted | approved | rejected
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    account = relationship("Account")
    creator = relationship("User", foreign_keys=[created_by])
    approver = relationship("User", foreign_keys=[approved_by])
    periods = relationship("BudgetPeriod", back_populates="budget", cascade="all, delete-orphan", order_by="BudgetPeriod.period_start")


class BudgetPeriod(Base):
    __tablename__ = "budget_periods"

    id = Column(Integer, primary_key=True, index=True)
    budget_id = Column(Integer, ForeignKey("budgets.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    period_label = Column(String(20), nullable=False)  # e.g. "2026", "2026-Q1", "2026-01"
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    amount = Column(Float, nullable=False, default=0)

    budget = relationship("Budget", back_populates="periods")
    tenant = relationship("Tenant")
