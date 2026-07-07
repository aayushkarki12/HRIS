"""
Voucher service - the single place that knows how to mint a standardized ERP
voucher document (Tally/ERPNext/Odoo-style) on top of the existing
JournalEntry/JournalEntryLine double-entry ledger.

This module never posts debits/credits itself. It either:
  (a) wraps a JournalEntry that some other endpoint already built and posted
      (expense payment, invoice send/payment, payroll run), or
  (b) builds a new JournalEntry using the exact same construction the
      /accounting/journal-entries endpoint uses, for manual voucher entry.
Either way, the ledger-posting logic lives in exactly one place per case -
this module just adds the document envelope (numbering, party info, status
workflow) around it.
"""
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models.accounting import Account, JournalEntry, JournalEntryLine
from ..models.voucher import Voucher
from ..models.user import User
from ..models.tenant import Tenant
from ..schemas.voucher import VOUCHER_PREFIXES
from .audit import record_audit_log

# Mirrors accounting.py's VOUCHER_PREFIXES / entry_number counter exactly, so
# JournalEntry numbers minted here never collide with ones minted by
# POST /accounting/journal-entries (both count JournalEntry rows filtered by
# the same tenant_id + voucher_type pair).
JOURNAL_ENTRY_PREFIXES = {
    "journal": "JE", "payment": "PAY", "receipt": "REC", "contra": "CON",
    "sales": "SAL", "purchase": "PUR", "debit_note": "DN", "credit_note": "CN",
}


def generate_voucher_number(db: Session, tenant_id: int, voucher_type: str, voucher_date: date) -> str:
    """PV-2026-000001 style numbering, sequential per tenant + voucher type + calendar year."""
    prefix = VOUCHER_PREFIXES.get(voucher_type, "JV")
    year = voucher_date.year
    count = db.query(Voucher).filter(
        Voucher.tenant_id == tenant_id,
        Voucher.voucher_type == voucher_type,
        Voucher.voucher_number.like(f"{prefix}-{year}-%"),
    ).count()
    return f"{prefix}-{year}-{count + 1:06d}"


def attach_voucher(
    db: Session,
    tenant: Tenant,
    journal_entry: JournalEntry,
    voucher_type: str,
    current_user: User,
    party_type: Optional[str] = None,
    party_name: Optional[str] = None,
    payment_method: Optional[str] = None,
    bank_account_id: Optional[int] = None,
    reference_number: Optional[str] = None,
    due_date: Optional[date] = None,
    source_type: Optional[str] = None,
    source_id: Optional[int] = None,
    status: str = "posted",
    remarks: Optional[str] = None,
) -> Voucher:
    """
    Wrap an already-created JournalEntry with a standardized Voucher document.
    Used by expense/invoice/payroll flows, whose JournalEntry is created and
    posted synchronously as part of one business action - the voucher for
    those is born already-posted, mirroring the underlying entry.
    """
    voucher_number = generate_voucher_number(db, tenant.id, voucher_type, journal_entry.date)
    now = datetime.utcnow()

    voucher = Voucher(
        tenant_id=tenant.id,
        journal_entry_id=journal_entry.id,
        voucher_type=voucher_type,
        voucher_number=voucher_number,
        voucher_date=journal_entry.date,
        status=status,
        party_type=party_type,
        party_name=party_name,
        payment_method=payment_method,
        bank_account_id=bank_account_id,
        reference_number=reference_number,
        due_date=due_date,
        source_type=source_type,
        source_id=source_id,
        remarks=remarks,
        prepared_by=current_user.id,
        approved_by=current_user.id if status in ("approved", "posted") else None,
        approved_at=now if status in ("approved", "posted") else None,
        posted_by=current_user.id if status == "posted" else None,
        posted_at=now if status == "posted" else None,
    )
    db.add(voucher)
    db.flush()

    record_audit_log(db, tenant.id, current_user.id, "create", "voucher", voucher.id,
                      f"Created {voucher_number} ({voucher_type}) from {source_type or 'manual'}")

    return voucher


def create_manual_voucher(
    db: Session,
    tenant: Tenant,
    current_user: User,
    voucher_type: str,
    voucher_date: date,
    description: str,
    lines: List,
    currency: str = "USD",
    party_type: Optional[str] = None,
    party_name: Optional[str] = None,
    payment_method: Optional[str] = None,
    bank_account_id: Optional[int] = None,
    reference_number: Optional[str] = None,
    due_date: Optional[date] = None,
    remarks: Optional[str] = None,
) -> Voucher:
    """
    Build a brand-new JournalEntry (draft) plus its Voucher wrapper, for
    manual entry from the Vouchers UI. Mirrors the exact construction used by
    POST /accounting/journal-entries so there is one debit/credit validation
    path, just entered from a different screen.
    """
    for line in lines:
        account = db.query(Account).filter(
            Account.id == line.account_id,
            Account.tenant_id == tenant.id,
            Account.is_active == True
        ).first()
        if not account:
            raise ValueError(f"Account with id {line.account_id} not found or inactive")

    reference_type_map = {
        "sales": "invoice", "purchase": "manual", "credit_note": "invoice", "debit_note": "manual",
    }
    prefix = JOURNAL_ENTRY_PREFIXES.get(voucher_type, "JE")
    series_count = db.query(JournalEntry).filter(
        JournalEntry.tenant_id == tenant.id,
        JournalEntry.voucher_type == voucher_type,
    ).count()
    entry_number = f"{prefix}-{series_count + 1:04d}"

    db_entry = JournalEntry(
        entry_number=entry_number,
        voucher_type=voucher_type,
        date=voucher_date,
        description=description,
        reference=reference_number,
        reference_type=reference_type_map.get(voucher_type, "manual"),
        status="draft",
        tenant_id=tenant.id,
    )
    db.add(db_entry)
    db.flush()

    for line_data in lines:
        db.add(JournalEntryLine(
            journal_entry_id=db_entry.id,
            account_id=line_data.account_id,
            description=line_data.description,
            debit=line_data.debit,
            credit=line_data.credit,
            cost_center_id=line_data.cost_center_id,
            tax_rate_id=line_data.tax_rate_id,
            tenant_id=tenant.id,
        ))

    db.flush()

    return attach_voucher(
        db, tenant, db_entry, voucher_type, current_user,
        party_type=party_type, party_name=party_name, payment_method=payment_method,
        bank_account_id=bank_account_id, reference_number=reference_number, due_date=due_date,
        source_type="manual", status="draft", remarks=remarks,
    )
