import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime, date

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.project import Project
from ...models.invoice import Invoice, InvoiceLine, Payment
from ...models.accounting import Account, JournalEntry, JournalEntryLine
from ...schemas.invoice import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    PaymentCreate, PaymentResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _load_invoice(db, invoice_id, tenant_id):
    return db.query(Invoice).options(
        joinedload(Invoice.lines),
        joinedload(Invoice.payments),
    ).filter(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id).first()


def _update_invoice_status(invoice):
    if invoice.amount_paid >= invoice.total_amount:
        invoice.status = "paid"
    elif invoice.amount_paid > 0:
        invoice.status = "partially_paid"
    elif invoice.due_date and invoice.due_date < date.today() and invoice.status == "sent":
        invoice.status = "overdue"


# ============================================
# STATIC ROUTES FIRST
# ============================================

@router.get("/stats")
def get_invoice_stats(
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get invoice statistics."""
    try:
        invoices = db.query(Invoice).filter(Invoice.tenant_id == tenant.id).all()
        total = len(invoices)
        total_amount = sum(i.total_amount for i in invoices)
        total_paid = sum(i.amount_paid for i in invoices)
        outstanding = total_amount - total_paid
        by_status = {}
        for inv in invoices:
            by_status[inv.status] = by_status.get(inv.status, 0) + 1
        return {
            "total_invoices": total,
            "total_amount": round(total_amount, 2),
            "total_paid": round(total_paid, 2),
            "outstanding": round(outstanding, 2),
            "by_status": by_status,
        }
    except Exception as e:
        logger.error(f"Error in get_invoice_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[InvoiceResponse])
def get_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all invoices for the current tenant."""
    try:
        query = db.query(Invoice).options(
            joinedload(Invoice.lines),
            joinedload(Invoice.payments),
        ).filter(Invoice.tenant_id == tenant.id)

        if status_filter:
            query = query.filter(Invoice.status == status_filter)

        return query.order_by(Invoice.issue_date.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error in get_invoices: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    data: InvoiceCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new invoice (admin only)."""
    try:
        if data.project_id:
            project = db.query(Project).filter(
                Project.id == data.project_id, Project.tenant_id == tenant.id
            ).first()
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")

        inv_count = db.query(Invoice).filter(Invoice.tenant_id == tenant.id).count()
        invoice_number = f"INV-{inv_count + 1:04d}"

        subtotal = sum(line.quantity * line.unit_price for line in data.lines)
        tax_amount = round(subtotal * (data.tax_rate / 100), 2)
        total_amount = round(subtotal + tax_amount, 2)

        db_invoice = Invoice(
            invoice_number=invoice_number,
            customer_name=data.customer_name,
            customer_email=data.customer_email,
            project_id=data.project_id,
            issue_date=data.issue_date,
            due_date=data.due_date,
            subtotal=round(subtotal, 2),
            tax_rate=data.tax_rate,
            tax_amount=tax_amount,
            total_amount=total_amount,
            amount_paid=0,
            status="draft",
            tenant_id=tenant.id,
        )
        db.add(db_invoice)
        db.flush()

        for line_data in data.lines:
            db_line = InvoiceLine(
                invoice_id=db_invoice.id,
                description=line_data.description,
                quantity=line_data.quantity,
                unit_price=line_data.unit_price,
                amount=round(line_data.quantity * line_data.unit_price, 2),
                tenant_id=tenant.id,
            )
            db.add(db_line)

        db.commit()
        return _load_invoice(db, db_invoice.id, tenant.id)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DYNAMIC ROUTES
# ============================================

@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get invoice by ID."""
    invoice = _load_invoice(db, invoice_id, tenant.id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.put("/{invoice_id}/send", response_model=InvoiceResponse)
def send_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Mark invoice as sent and create accounts receivable journal entry."""
    try:
        invoice = _load_invoice(db, invoice_id, tenant.id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft invoices can be sent")

        receivable_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["1200", "1100"]),
            Account.is_active == True
        ).first()
        revenue_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["4000", "4100"]),
            Account.is_active == True
        ).first()

        if receivable_account and revenue_account:
            entry_count = db.query(JournalEntry).filter(JournalEntry.tenant_id == tenant.id).count()
            entry_number = f"JE-{entry_count + 1:04d}"

            db_entry = JournalEntry(
                entry_number=entry_number,
                date=invoice.issue_date,
                description=f"Invoice {invoice.invoice_number} to {invoice.customer_name}",
                reference=invoice.invoice_number,
                reference_type="invoice",
                status="posted",
                posted_by=current_user.id,
                posted_at=datetime.now(),
                tenant_id=tenant.id,
            )
            db.add(db_entry)
            db.flush()

            db.add(JournalEntryLine(
                journal_entry_id=db_entry.id,
                account_id=receivable_account.id,
                description=f"Accounts receivable - {invoice.invoice_number}",
                debit=invoice.total_amount,
                credit=0,
                tenant_id=tenant.id,
            ))
            db.add(JournalEntryLine(
                journal_entry_id=db_entry.id,
                account_id=revenue_account.id,
                description=f"Revenue - {invoice.invoice_number}",
                debit=0,
                credit=invoice.total_amount,
                tenant_id=tenant.id,
            ))
            invoice.journal_entry_id = db_entry.id

        invoice.status = "sent"
        record_audit_log(db, tenant.id, current_user.id, "send", "invoice", invoice.id,
                          f"Sent {invoice.invoice_number} to {invoice.customer_name} ({invoice.total_amount})")
        db.commit()
        return _load_invoice(db, invoice.id, tenant.id)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in send_invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    invoice_id: int,
    data: PaymentCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Record a payment against an invoice."""
    try:
        invoice = _load_invoice(db, invoice_id, tenant.id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.status in ["draft", "cancelled"]:
            raise HTTPException(status_code=400, detail=f"Cannot record payment for {invoice.status} invoice")

        outstanding = invoice.total_amount - invoice.amount_paid
        if data.amount > outstanding + 0.01:
            raise HTTPException(status_code=400, detail=f"Payment exceeds outstanding balance ({outstanding:.2f})")

        db_payment = Payment(
            invoice_id=invoice.id,
            amount=data.amount,
            payment_date=data.payment_date,
            payment_method=data.payment_method,
            reference=data.reference,
            tenant_id=tenant.id,
        )

        cash_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["1000", "1100"]),
            Account.is_active == True
        ).first()
        receivable_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["1200", "1100"]),
            Account.is_active == True
        ).first()

        if cash_account and receivable_account and cash_account.id != receivable_account.id:
            entry_count = db.query(JournalEntry).filter(JournalEntry.tenant_id == tenant.id).count()
            entry_number = f"JE-{entry_count + 1:04d}"

            db_entry = JournalEntry(
                entry_number=entry_number,
                date=data.payment_date,
                description=f"Payment received for {invoice.invoice_number}",
                reference=f"{invoice.invoice_number}-PMT",
                reference_type="invoice",
                status="posted",
                posted_by=current_user.id,
                posted_at=datetime.now(),
                tenant_id=tenant.id,
            )
            db.add(db_entry)
            db.flush()

            db.add(JournalEntryLine(
                journal_entry_id=db_entry.id,
                account_id=cash_account.id,
                description=f"Payment received - {invoice.invoice_number}",
                debit=data.amount,
                credit=0,
                tenant_id=tenant.id,
            ))
            db.add(JournalEntryLine(
                journal_entry_id=db_entry.id,
                account_id=receivable_account.id,
                description=f"Receivable cleared - {invoice.invoice_number}",
                debit=0,
                credit=data.amount,
                tenant_id=tenant.id,
            ))
            db_payment.journal_entry_id = db_entry.id

        db.add(db_payment)
        invoice.amount_paid = round(invoice.amount_paid + data.amount, 2)
        _update_invoice_status(invoice)

        record_audit_log(db, tenant.id, current_user.id, "record_payment", "invoice", invoice.id,
                          f"Recorded payment of {data.amount} for {invoice.invoice_number} via {data.payment_method}")

        db.commit()
        db.refresh(db_payment)
        return db_payment
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in record_payment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Cancel an invoice."""
    try:
        invoice = _load_invoice(db, invoice_id, tenant.id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.amount_paid > 0:
            raise HTTPException(status_code=400, detail="Cannot cancel invoice with payments")

        invoice.status = "cancelled"
        record_audit_log(db, tenant.id, current_user.id, "cancel", "invoice", invoice.id,
                          f"Cancelled {invoice.invoice_number}")
        db.commit()
        return _load_invoice(db, invoice.id, tenant.id)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in cancel_invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{invoice_id}")
def delete_invoice(
    invoice_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a draft invoice."""
    try:
        invoice = db.query(Invoice).filter(
            Invoice.id == invoice_id, Invoice.tenant_id == tenant.id
        ).first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if invoice.status != "draft":
            raise HTTPException(status_code=400, detail="Can only delete draft invoices")

        db.query(InvoiceLine).filter(InvoiceLine.invoice_id == invoice.id).delete()
        db.delete(invoice)
        db.commit()
        return {"message": "Invoice deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_invoice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
