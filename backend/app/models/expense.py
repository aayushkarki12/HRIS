from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class ExpenseClaim(Base):
    __tablename__ = "expense_claims"
    __table_args__ = (
        UniqueConstraint("tenant_id", "claim_number", name="uq_expense_claims_tenant_claim_number"),
        Index("ix_expense_claims_tenant_status", "tenant_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    claim_number = Column(String(20), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    total_amount = Column(Float, default=0)
    status = Column(String(20), default="draft", nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    manager_approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager_approved_at = Column(DateTime(timezone=True), nullable=True)
    accounting_approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    accounting_approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employee = relationship("Employee", backref="expense_claims")
    tenant = relationship("Tenant", back_populates="expense_claims")
    manager_approver = relationship("User", foreign_keys=[manager_approved_by])
    accounting_approver = relationship("User", foreign_keys=[accounting_approved_by])
    rejecter = relationship("User", foreign_keys=[rejected_by])
    journal_entry = relationship("JournalEntry")
    lines = relationship("ExpenseClaimLine", back_populates="expense_claim", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ExpenseClaim {self.claim_number} - {self.status}>"


class ExpenseClaimLine(Base):
    __tablename__ = "expense_claim_lines"

    id = Column(Integer, primary_key=True, index=True)
    expense_claim_id = Column(Integer, ForeignKey("expense_claims.id"), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String(50), nullable=False)
    receipt_url = Column(String(500), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    expense_claim = relationship("ExpenseClaim", back_populates="lines")
    tenant = relationship("Tenant", back_populates="expense_claim_lines")

    def __repr__(self):
        return f"<ExpenseClaimLine {self.category} - {self.amount}>"
