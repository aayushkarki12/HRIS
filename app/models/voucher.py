from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Voucher(Base):
    """
    Standardized ERP voucher document (Tally/ERPNext/Odoo-style) that wraps an
    existing JournalEntry. This is deliberately a thin layer on top of the
    proven double-entry posting logic in JournalEntry/JournalEntryLine - it
    does NOT duplicate ledger lines. All debit/credit/account/cost-center/tax
    data lives on journal_entry.lines; this table only adds the document-level
    concerns (voucher numbering, party info, approval workflow, provenance)
    that the ledger itself has no reason to know about.
    """
    __tablename__ = "vouchers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "voucher_number", name="uq_vouchers_tenant_number"),
        Index("ix_vouchers_tenant_type_status", "tenant_id", "voucher_type", "status"),
        Index("ix_vouchers_tenant_date", "tenant_id", "voucher_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False, unique=True)

    voucher_type = Column(String(20), nullable=False)  # payment/receipt/contra/journal/sales/purchase/credit_note/debit_note
    voucher_number = Column(String(30), nullable=False)  # e.g. PV-2026-000001
    voucher_date = Column(Date, nullable=False)
    currency = Column(String(10), default="USD", nullable=False)

    # Workflow: draft -> submitted -> approved -> posted (or rejected/cancelled at any pre-posted step)
    status = Column(String(20), default="draft", nullable=False)

    # Party info - shape depends on voucher_type (payee/payer/customer/vendor).
    party_type = Column(String(20), nullable=True)  # employee/customer/vendor/other
    party_name = Column(String(150), nullable=True)
    payment_method = Column(String(20), nullable=True)  # cash/bank/cheque/online
    bank_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    reference_number = Column(String(100), nullable=True)
    due_date = Column(Date, nullable=True)

    # Provenance - what business event generated this voucher, if any.
    source_type = Column(String(30), nullable=True)  # expense_claim/invoice/payroll_run/manual
    source_id = Column(Integer, nullable=True)

    remarks = Column(Text, nullable=True)
    rejected_reason = Column(Text, nullable=True)
    attachment_url = Column(String(255), nullable=True)

    prepared_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    posted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    journal_entry = relationship("JournalEntry")
    bank_account = relationship("Account", foreign_keys=[bank_account_id])
    preparer = relationship("User", foreign_keys=[prepared_by])
    submitter = relationship("User", foreign_keys=[submitted_by])
    approver = relationship("User", foreign_keys=[approved_by])
    poster = relationship("User", foreign_keys=[posted_by])

    def __repr__(self):
        return f"<Voucher {self.voucher_number} ({self.voucher_type})>"
