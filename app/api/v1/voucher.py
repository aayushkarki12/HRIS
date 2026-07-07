import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...core.voucher_service import create_manual_voucher
from ...models.user import User
from ...models.tenant import Tenant
from ...models.voucher import Voucher
from ...models.accounting import JournalEntry, JournalEntryLine
from ...schemas.voucher import (
    VoucherCreate, VoucherResponse, VoucherActionRequest, VOUCHER_LABELS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


def _hydrate(voucher: Voucher) -> Voucher:
    """Attach the computed, non-persisted display fields the schema expects."""
    voucher.voucher_label = VOUCHER_LABELS.get(voucher.voucher_type, voucher.voucher_type.title())
    voucher.accounting_period = voucher.voucher_date.strftime("%B %Y") if voucher.voucher_date else None
    if voucher.journal_entry:
        voucher.total_debit = round(sum(l.debit for l in voucher.journal_entry.lines), 2)
        voucher.total_credit = round(sum(l.credit for l in voucher.journal_entry.lines), 2)
    else:
        voucher.total_debit = voucher.total_credit = 0.0
    return voucher


def _load(db: Session, voucher_id: int, tenant_id: int) -> Optional[Voucher]:
    return db.query(Voucher).options(
        joinedload(Voucher.journal_entry).joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account),
        joinedload(Voucher.journal_entry).joinedload(JournalEntry.lines).joinedload(JournalEntryLine.cost_center),
        joinedload(Voucher.journal_entry).joinedload(JournalEntry.lines).joinedload(JournalEntryLine.tax_rate),
        joinedload(Voucher.preparer), joinedload(Voucher.approver), joinedload(Voucher.poster),
    ).filter(Voucher.id == voucher_id, Voucher.tenant_id == tenant_id).first()


@router.get("/", response_model=List[VoucherResponse])
def get_vouchers(
    voucher_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """List vouchers for the current tenant - the standardized document view over journal entries."""
    query = db.query(Voucher).options(
        joinedload(Voucher.journal_entry).joinedload(JournalEntry.lines),
        joinedload(Voucher.preparer), joinedload(Voucher.approver), joinedload(Voucher.poster),
    ).filter(Voucher.tenant_id == tenant.id)

    if voucher_type:
        query = query.filter(Voucher.voucher_type == voucher_type)
    if status_filter:
        query = query.filter(Voucher.status == status_filter)

    vouchers = query.order_by(Voucher.voucher_date.desc(), Voucher.id.desc()).offset(skip).limit(limit).all()
    return [_hydrate(v) for v in vouchers]


@router.post("/", response_model=VoucherResponse, status_code=status.HTTP_201_CREATED)
def create_voucher(
    data: VoucherCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Create a new voucher (draft) - the standardized entry point for manual accounting transactions."""
    try:
        voucher = create_manual_voucher(
            db, tenant, current_user,
            voucher_type=data.voucher_type,
            voucher_date=data.voucher_date,
            description=data.description,
            lines=data.lines,
            currency=data.currency,
            party_type=data.party_type,
            party_name=data.party_name,
            payment_method=data.payment_method,
            bank_account_id=data.bank_account_id,
            reference_number=data.reference_number,
            due_date=data.due_date,
            remarks=data.remarks,
        )
        db.commit()
        return _hydrate(_load(db, voucher.id, tenant.id))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_voucher: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{voucher_id}", response_model=VoucherResponse)
def get_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return _hydrate(voucher)


@router.put("/{voucher_id}/submit", response_model=VoucherResponse)
def submit_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot submit a voucher in '{voucher.status}' status")

    voucher.status = "submitted"
    voucher.submitted_by = current_user.id
    voucher.submitted_at = datetime.utcnow()
    record_audit_log(db, tenant.id, current_user.id, "submit", "voucher", voucher.id,
                      f"Submitted {voucher.voucher_number} for approval")
    db.commit()
    return _hydrate(_load(db, voucher_id, tenant.id))


@router.put("/{voucher_id}/approve", response_model=VoucherResponse)
def approve_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status != "submitted":
        raise HTTPException(status_code=400, detail=f"Cannot approve a voucher in '{voucher.status}' status")

    voucher.status = "approved"
    voucher.approved_by = current_user.id
    voucher.approved_at = datetime.utcnow()
    record_audit_log(db, tenant.id, current_user.id, "approve", "voucher", voucher.id,
                      f"Approved {voucher.voucher_number}")
    db.commit()
    return _hydrate(_load(db, voucher_id, tenant.id))


@router.put("/{voucher_id}/reject", response_model=VoucherResponse)
def reject_voucher(
    voucher_id: int,
    data: VoucherActionRequest,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status not in ("submitted", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a voucher in '{voucher.status}' status")

    voucher.status = "rejected"
    voucher.rejected_reason = data.remarks
    record_audit_log(db, tenant.id, current_user.id, "reject", "voucher", voucher.id,
                      f"Rejected {voucher.voucher_number}" + (f": {data.remarks}" if data.remarks else ""))
    db.commit()
    return _hydrate(_load(db, voucher_id, tenant.id))


@router.put("/{voucher_id}/cancel", response_model=VoucherResponse)
def cancel_voucher(
    voucher_id: int,
    data: VoucherActionRequest,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status == "posted":
        raise HTTPException(status_code=400, detail="Cannot cancel a posted voucher - post a reversing voucher instead")

    voucher.status = "cancelled"
    if data.remarks:
        voucher.remarks = f"{voucher.remarks or ''}\n\nCancelled: {data.remarks}".strip()
    record_audit_log(db, tenant.id, current_user.id, "cancel", "voucher", voucher.id,
                      f"Cancelled {voucher.voucher_number}")
    db.commit()
    return _hydrate(_load(db, voucher_id, tenant.id))


@router.put("/{voucher_id}/post", response_model=VoucherResponse)
def post_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    """Post the voucher's underlying journal entry to the general ledger - same validation as posting a journal entry directly."""
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status not in ("draft", "approved"):
        raise HTTPException(status_code=400, detail=f"Cannot post a voucher in '{voucher.status}' status")

    entry = voucher.journal_entry
    if not entry.lines or len(entry.lines) < 2:
        raise HTTPException(status_code=400, detail="Voucher must have at least 2 accounting lines")

    total_debit = sum(l.debit for l in entry.lines)
    total_credit = sum(l.credit for l in entry.lines)
    if round(total_debit, 2) != round(total_credit, 2):
        raise HTTPException(
            status_code=400,
            detail=f"Total debits ({total_debit:.2f}) must equal total credits ({total_credit:.2f})"
        )

    now = datetime.utcnow()
    entry.status = "posted"
    entry.posted_by = current_user.id
    entry.posted_at = now
    voucher.status = "posted"
    voucher.posted_by = current_user.id
    voucher.posted_at = now
    if not voucher.approved_by:
        voucher.approved_by = current_user.id
        voucher.approved_at = now

    record_audit_log(db, tenant.id, current_user.id, "post", "voucher", voucher.id,
                      f"Posted {voucher.voucher_number} to the general ledger")
    db.commit()
    return _hydrate(_load(db, voucher_id, tenant.id))


@router.delete("/{voucher_id}")
def delete_voucher(
    voucher_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    voucher = _load(db, voucher_id, tenant.id)
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    if voucher.status not in ("draft", "rejected", "cancelled"):
        raise HTTPException(status_code=400, detail="Only draft, rejected, or cancelled vouchers can be deleted")

    entry = voucher.journal_entry
    db.delete(voucher)
    db.delete(entry)
    db.commit()
    return {"message": "Voucher deleted successfully"}
