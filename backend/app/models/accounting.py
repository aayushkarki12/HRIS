from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class LedgerGroup(Base):
    """
    Tally-style ledger group: a hierarchical bucket (Assets > Current Assets > Bank
    Accounts) that ledgers (Accounts) are filed under. Distinct from Account.parent_id,
    which is an unrelated pre-existing ledger-to-ledger hierarchy left untouched here.
    """
    __tablename__ = "ledger_groups"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_ledger_groups_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("ledger_groups.id"), nullable=True)
    nature = Column(String(20), nullable=False)  # asset/liability/equity/income/expense
    color = Column(String(20), nullable=True)
    icon = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    parent = relationship("LedgerGroup", remote_side=[id], backref="children")

    def __repr__(self):
        return f"<LedgerGroup {self.code} - {self.name}>"


class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_accounts_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    account_type = Column(String(20), nullable=False)
    parent_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    ledger_group_id = Column(Integer, ForeignKey("ledger_groups.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="accounts")
    parent = relationship("Account", remote_side=[id], backref="children")
    ledger_group = relationship("LedgerGroup", backref="accounts")
    journal_lines = relationship("JournalEntryLine", back_populates="account")

    def __repr__(self):
        return f"<Account {self.code} - {self.name}>"


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "entry_number", name="uq_journal_entries_tenant_entry_number"),
        Index("ix_journal_entries_tenant_date", "tenant_id", "date"),
        Index("ix_journal_entries_tenant_status", "tenant_id", "status"),
        Index("ix_journal_entries_tenant_voucher_type", "tenant_id", "voucher_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(20), nullable=False)
    # Tally-style voucher classification: journal/payment/receipt/contra/sales/
    # purchase/debit_note/credit_note. Every voucher IS a journal entry - this
    # column just tags which quick-entry form and numbering series produced it.
    voucher_type = Column(String(20), default="journal", nullable=False)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    reference = Column(String(100), nullable=True)
    reference_type = Column(String(20), nullable=True)
    status = Column(String(20), default="draft", nullable=False)
    posted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="journal_entries")
    poster = relationship("User", foreign_keys=[posted_by])
    lines = relationship("JournalEntryLine", back_populates="journal_entry", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<JournalEntry {self.entry_number}>"


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    description = Column(String(255), nullable=True)
    debit = Column(Float, default=0, nullable=False)
    credit = Column(Float, default=0, nullable=False)
    cost_center_id = Column(Integer, ForeignKey("cost_centers.id"), nullable=True)
    tax_rate_id = Column(Integer, ForeignKey("tax_rates.id"), nullable=True)
    is_reconciled = Column(Boolean, default=False, nullable=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    journal_entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("Account", back_populates="journal_lines")
    tenant = relationship("Tenant", back_populates="journal_entry_lines")
    cost_center = relationship("CostCenter", back_populates="journal_lines")
    tax_rate = relationship("TaxRate", back_populates="journal_lines")

    def __repr__(self):
        return f"<JournalEntryLine {self.id} D:{self.debit} C:{self.credit}>"


class CostCenter(Base):
    """
    Tally-style cost center: tag journal lines to a department/project so
    spend can be sliced independently of the chart of accounts.
    """
    __tablename__ = "cost_centers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_cost_centers_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("cost_centers.id"), nullable=True)
    budget_amount = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    parent = relationship("CostCenter", remote_side=[id], backref="children")
    journal_lines = relationship("JournalEntryLine", back_populates="cost_center")

    def __repr__(self):
        return f"<CostCenter {self.code} - {self.name}>"


class TaxRate(Base):
    """GST/VAT-style tax rate used to tag journal lines for tax summary reporting."""
    __tablename__ = "tax_rates"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(50), nullable=False)
    tax_type = Column(String(20), default="GST", nullable=False)  # GST/CGST/SGST/IGST/VAT/other
    rate = Column(Float, nullable=False)  # percentage, e.g. 18 for 18%
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    journal_lines = relationship("JournalEntryLine", back_populates="tax_rate")

    def __repr__(self):
        return f"<TaxRate {self.name} {self.rate}%>"


class BankReconciliation(Base):
    """Record of a completed bank reconciliation session for a cash/bank account."""
    __tablename__ = "bank_reconciliations"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    statement_date = Column(Date, nullable=False)
    statement_balance = Column(Float, nullable=False)
    book_balance = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    reconciled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
    account = relationship("Account")
    reconciler = relationship("User")

    def __repr__(self):
        return f"<BankReconciliation account={self.account_id} {self.statement_date}>"
