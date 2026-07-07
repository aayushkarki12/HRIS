import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime, date

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.accounting import Account, JournalEntry, JournalEntryLine, CostCenter, TaxRate, BankReconciliation, LedgerGroup
from ...models.invoice import Invoice
from ...models.expense import ExpenseClaim
from ...schemas.accounting import (
    AccountCreate, AccountUpdate, AccountResponse, AccountTreeResponse,
    JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse,
    LedgerAccountResponse, LedgerLineResponse,
    CostCenterCreate, CostCenterUpdate, CostCenterResponse,
    TaxRateCreate, TaxRateUpdate, TaxRateResponse,
    ReconciliationStatusResponse, ReconcileRequest, BankReconciliationResponse,
    UnreconciledLineResponse,
    LedgerGroupCreate, LedgerGroupUpdate, LedgerGroupResponse, LedgerGroupTreeResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accounting", tags=["accounting"])

# Tally-style voucher numbering series - each voucher type gets its own sequence.
VOUCHER_PREFIXES = {
    "journal": "JE", "payment": "PAY", "receipt": "REC", "contra": "CON",
    "sales": "SAL", "purchase": "PUR", "debit_note": "DN", "credit_note": "CN",
}

# ============================================
# ACCOUNTS - STATIC ROUTES FIRST
# ============================================

@router.get("/accounts/tree", response_model=List[AccountTreeResponse])
def get_account_tree(
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get chart of accounts as a tree structure."""
    try:
        accounts = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.parent_id == None
        ).order_by(Account.code).all()

        def build_tree(account):
            children = db.query(Account).filter(
                Account.tenant_id == tenant.id,
                Account.parent_id == account.id
            ).order_by(Account.code).all()

            return AccountTreeResponse(
                id=account.id,
                code=account.code,
                name=account.name,
                account_type=account.account_type,
                parent_id=account.parent_id,
                ledger_group_id=account.ledger_group_id,
                description=account.description,
                is_active=account.is_active,
                tenant_id=account.tenant_id,
                created_at=account.created_at,
                updated_at=account.updated_at,
                children=[build_tree(child) for child in children]
            )

        return [build_tree(acc) for acc in accounts]
    except Exception as e:
        logger.error(f"Error in get_account_tree: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts/types")
def get_account_types(
    current_user: User = Depends(get_current_manager_user),
):
    """Get available account types."""
    return [
        {"value": "asset", "label": "Asset"},
        {"value": "liability", "label": "Liability"},
        {"value": "equity", "label": "Equity"},
        {"value": "income", "label": "Income"},
        {"value": "expense", "label": "Expense"},
    ]


@router.get("/accounts", response_model=List[AccountResponse])
def get_accounts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    account_type: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all accounts for the current tenant."""
    try:
        query = db.query(Account).filter(Account.tenant_id == tenant.id)

        if account_type:
            query = query.filter(Account.account_type == account_type)
        if search:
            query = query.filter(
                (Account.code.contains(search)) |
                (Account.name.contains(search))
            )
        if is_active is not None:
            query = query.filter(Account.is_active == is_active)

        accounts = query.order_by(Account.code).offset(skip).limit(limit).all()
        return accounts
    except Exception as e:
        logger.error(f"Error in get_accounts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/accounts", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new account (admin only)."""
    try:
        existing = db.query(Account).filter(
            Account.code == account_data.code,
            Account.tenant_id == tenant.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Account code already exists")

        if account_data.parent_id:
            parent = db.query(Account).filter(
                Account.id == account_data.parent_id,
                Account.tenant_id == tenant.id
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent account not found")

        db_account = Account(**account_data.model_dump(), tenant_id=tenant.id)
        db.add(db_account)
        db.commit()
        db.refresh(db_account)
        return db_account
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ACCOUNTS - DYNAMIC ROUTES
# ============================================

@router.get("/accounts/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get account by ID."""
    try:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.tenant_id == tenant.id
        ).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        return account
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/accounts/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: int,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update an account (admin only)."""
    try:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.tenant_id == tenant.id
        ).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        update_data = account_data.model_dump(exclude_unset=True)

        if "code" in update_data and update_data["code"] != account.code:
            existing = db.query(Account).filter(
                Account.code == update_data["code"],
                Account.tenant_id == tenant.id,
                Account.id != account_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Account code already exists")

        if "parent_id" in update_data and update_data["parent_id"]:
            if update_data["parent_id"] == account_id:
                raise HTTPException(status_code=400, detail="Account cannot be its own parent")
            parent = db.query(Account).filter(
                Account.id == update_data["parent_id"],
                Account.tenant_id == tenant.id
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent account not found")

        for key, value in update_data.items():
            setattr(account, key, value)

        db.commit()
        db.refresh(account)
        return account
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate an account (admin only)."""
    try:
        account = db.query(Account).filter(
            Account.id == account_id,
            Account.tenant_id == tenant.id
        ).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        children = db.query(Account).filter(
            Account.parent_id == account_id,
            Account.tenant_id == tenant.id
        ).count()
        if children > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate account with child accounts"
            )

        account.is_active = False
        record_audit_log(db, tenant.id, current_user.id, "deactivate", "account", account.id,
                          f"Deactivated account {account.code} - {account.name}")
        db.commit()
        return {"message": "Account deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# JOURNAL ENTRIES - STATIC ROUTES FIRST
# ============================================

@router.get("/journal-entries", response_model=List[JournalEntryResponse])
def get_journal_entries(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    reference_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all journal entries for the current tenant."""
    try:
        query = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(JournalEntry.tenant_id == tenant.id)

        if status_filter:
            query = query.filter(JournalEntry.status == status_filter)
        if reference_type:
            query = query.filter(JournalEntry.reference_type == reference_type)
        if start_date:
            query = query.filter(JournalEntry.date >= start_date)
        if end_date:
            query = query.filter(JournalEntry.date <= end_date)

        entries = query.order_by(JournalEntry.date.desc(), JournalEntry.id.desc()).offset(skip).limit(limit).all()
        return entries
    except Exception as e:
        logger.error(f"Error in get_journal_entries: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/journal-entries", response_model=JournalEntryResponse, status_code=status.HTTP_201_CREATED)
def create_journal_entry(
    entry_data: JournalEntryCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new journal entry with lines (admin only). Validates double-entry."""
    try:
        for line in entry_data.lines:
            account = db.query(Account).filter(
                Account.id == line.account_id,
                Account.tenant_id == tenant.id,
                Account.is_active == True
            ).first()
            if not account:
                raise HTTPException(
                    status_code=404,
                    detail=f"Account with id {line.account_id} not found or inactive"
                )

        for line in entry_data.lines:
            if line.cost_center_id:
                cc = db.query(CostCenter).filter(
                    CostCenter.id == line.cost_center_id, CostCenter.tenant_id == tenant.id
                ).first()
                if not cc:
                    raise HTTPException(status_code=404, detail=f"Cost center {line.cost_center_id} not found")
            if line.tax_rate_id:
                tr = db.query(TaxRate).filter(
                    TaxRate.id == line.tax_rate_id, TaxRate.tenant_id == tenant.id
                ).first()
                if not tr:
                    raise HTTPException(status_code=404, detail=f"Tax rate {line.tax_rate_id} not found")

        voucher_type = entry_data.voucher_type or "journal"
        prefix = VOUCHER_PREFIXES.get(voucher_type, "JE")
        series_count = db.query(JournalEntry).filter(
            JournalEntry.tenant_id == tenant.id,
            JournalEntry.voucher_type == voucher_type,
        ).count()
        entry_number = f"{prefix}-{series_count + 1:04d}"

        db_entry = JournalEntry(
            entry_number=entry_number,
            voucher_type=voucher_type,
            date=entry_data.date,
            description=entry_data.description,
            reference=entry_data.reference,
            reference_type=entry_data.reference_type or "manual",
            status="draft",
            tenant_id=tenant.id,
        )
        db.add(db_entry)
        db.flush()

        for line_data in entry_data.lines:
            db_line = JournalEntryLine(
                journal_entry_id=db_entry.id,
                account_id=line_data.account_id,
                description=line_data.description,
                debit=line_data.debit,
                credit=line_data.credit,
                cost_center_id=line_data.cost_center_id,
                tax_rate_id=line_data.tax_rate_id,
                tenant_id=tenant.id,
            )
            db.add(db_line)

        record_audit_log(db, tenant.id, current_user.id, "create", "journal_entry", db_entry.id,
                          f"Created {voucher_type} voucher {entry_number}")

        db.commit()
        db.refresh(db_entry)

        result = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(JournalEntry.id == db_entry.id).first()

        return result
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A journal entry with this number was just created by another request. Please try again."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_journal_entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# JOURNAL ENTRIES - DYNAMIC ROUTES
# ============================================

@router.get("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
def get_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get journal entry by ID with lines."""
    try:
        entry = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(
            JournalEntry.id == entry_id,
            JournalEntry.tenant_id == tenant.id
        ).first()

        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")
        return entry
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_journal_entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/journal-entries/{entry_id}", response_model=JournalEntryResponse)
def update_journal_entry(
    entry_id: int,
    entry_data: JournalEntryUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a draft journal entry (admin only). Cannot update posted entries."""
    try:
        entry = db.query(JournalEntry).filter(
            JournalEntry.id == entry_id,
            JournalEntry.tenant_id == tenant.id
        ).first()

        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")

        if entry.status == "posted":
            raise HTTPException(status_code=400, detail="Cannot edit a posted journal entry")

        update_data = entry_data.model_dump(exclude_unset=True)
        lines_data = update_data.pop("lines", None)

        for key, value in update_data.items():
            setattr(entry, key, value)

        if lines_data is not None:
            for line in entry_data.lines:
                account = db.query(Account).filter(
                    Account.id == line.account_id,
                    Account.tenant_id == tenant.id,
                    Account.is_active == True
                ).first()
                if not account:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Account with id {line.account_id} not found or inactive"
                    )

            db.query(JournalEntryLine).filter(
                JournalEntryLine.journal_entry_id == entry.id
            ).delete()

            for line_data in entry_data.lines:
                db_line = JournalEntryLine(
                    journal_entry_id=entry.id,
                    account_id=line_data.account_id,
                    description=line_data.description,
                    debit=line_data.debit,
                    credit=line_data.credit,
                    cost_center_id=line_data.cost_center_id,
                    tax_rate_id=line_data.tax_rate_id,
                    tenant_id=tenant.id,
                )
                db.add(db_line)

        db.commit()

        result = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(JournalEntry.id == entry.id).first()

        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_journal_entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/journal-entries/{entry_id}/post", response_model=JournalEntryResponse)
def post_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Post a draft journal entry (admin only). Makes it permanent."""
    try:
        entry = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(
            JournalEntry.id == entry_id,
            JournalEntry.tenant_id == tenant.id
        ).first()

        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")

        if entry.status == "posted":
            raise HTTPException(status_code=400, detail="Journal entry is already posted")

        if not entry.lines or len(entry.lines) < 2:
            raise HTTPException(status_code=400, detail="Journal entry must have at least 2 lines")

        total_debit = sum(line.debit for line in entry.lines)
        total_credit = sum(line.credit for line in entry.lines)
        if round(total_debit, 2) != round(total_credit, 2):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot post: debits ({total_debit:.2f}) do not equal credits ({total_credit:.2f})"
            )

        entry.status = "posted"
        entry.posted_by = current_user.id
        entry.posted_at = datetime.now()

        record_audit_log(db, tenant.id, current_user.id, "post", "journal_entry", entry.id,
                          f"Posted {entry.entry_number}: {entry.description} (debit/credit {total_debit:.2f})")

        db.commit()
        db.refresh(entry)

        result = db.query(JournalEntry).options(
            joinedload(JournalEntry.lines).joinedload(JournalEntryLine.account)
        ).filter(JournalEntry.id == entry.id).first()

        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in post_journal_entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/journal-entries/{entry_id}")
def delete_journal_entry(
    entry_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a draft journal entry (admin only). Cannot delete posted entries."""
    try:
        entry = db.query(JournalEntry).filter(
            JournalEntry.id == entry_id,
            JournalEntry.tenant_id == tenant.id
        ).first()

        if not entry:
            raise HTTPException(status_code=404, detail="Journal entry not found")

        if entry.status == "posted":
            raise HTTPException(status_code=400, detail="Cannot delete a posted journal entry")

        db.query(JournalEntryLine).filter(
            JournalEntryLine.journal_entry_id == entry.id
        ).delete()
        db.delete(entry)
        db.commit()

        return {"message": "Journal entry deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_journal_entry: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GENERAL LEDGER
# ============================================

@router.get("/ledger", response_model=List[LedgerAccountResponse])
def get_general_ledger(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account_id: Optional[int] = None,
    account_type: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get general ledger with running balances.
    Only includes posted journal entries.
    """
    try:
        accounts_query = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.is_active == True
        )
        if account_id:
            accounts_query = accounts_query.filter(Account.id == account_id)
        if account_type:
            accounts_query = accounts_query.filter(Account.account_type == account_type)

        accounts = accounts_query.order_by(Account.code).all()

        result = []
        for account in accounts:
            lines_query = db.query(JournalEntryLine, JournalEntry).join(
                JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
            ).filter(
                JournalEntryLine.account_id == account.id,
                JournalEntryLine.tenant_id == tenant.id,
                JournalEntry.status == "posted"
            )

            if start_date:
                lines_query = lines_query.filter(JournalEntry.date >= start_date)
            if end_date:
                lines_query = lines_query.filter(JournalEntry.date <= end_date)

            lines_query = lines_query.order_by(JournalEntry.date, JournalEntry.id)
            raw_lines = lines_query.all()

            if not raw_lines and not account_id and not account_type:
                continue

            running_balance = 0.0
            total_debit = 0.0
            total_credit = 0.0
            ledger_lines = []

            for line, entry in raw_lines:
                if account.account_type in ("asset", "expense"):
                    running_balance += line.debit - line.credit
                else:
                    running_balance += line.credit - line.debit

                total_debit += line.debit
                total_credit += line.credit

                ledger_lines.append(LedgerLineResponse(
                    id=line.id,
                    date=entry.date,
                    entry_number=entry.entry_number,
                    journal_entry_id=entry.id,
                    description=line.description,
                    entry_description=entry.description,
                    reference=entry.reference,
                    debit=line.debit,
                    credit=line.credit,
                    running_balance=round(running_balance, 2),
                ))

            result.append(LedgerAccountResponse(
                account_id=account.id,
                account_code=account.code,
                account_name=account.name,
                account_type=account.account_type,
                opening_balance=0.0,
                total_debit=round(total_debit, 2),
                total_credit=round(total_credit, 2),
                closing_balance=round(running_balance, 2),
                lines=ledger_lines,
            ))

        return result
    except Exception as e:
        logger.error(f"Error in get_general_ledger: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ledger/summary")
def get_ledger_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get summary totals grouped by account type. Only posted entries."""
    try:
        lines_query = db.query(
            Account.account_type,
            func.sum(JournalEntryLine.debit).label("total_debit"),
            func.sum(JournalEntryLine.credit).label("total_credit"),
        ).join(
            Account, JournalEntryLine.account_id == Account.id
        ).join(
            JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
        ).filter(
            JournalEntryLine.tenant_id == tenant.id,
            JournalEntry.status == "posted"
        )

        if start_date:
            lines_query = lines_query.filter(JournalEntry.date >= start_date)
        if end_date:
            lines_query = lines_query.filter(JournalEntry.date <= end_date)

        rows = lines_query.group_by(Account.account_type).all()

        summary = {}
        for account_type, total_debit, total_credit in rows:
            td = float(total_debit or 0)
            tc = float(total_credit or 0)
            if account_type in ("asset", "expense"):
                balance = td - tc
            else:
                balance = tc - td
            summary[account_type] = {
                "total_debit": round(td, 2),
                "total_credit": round(tc, 2),
                "balance": round(balance, 2),
            }

        return summary
    except Exception as e:
        logger.error(f"Error in get_ledger_summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# FINANCIAL REPORTS
# ============================================

def _get_account_balances(db, tenant_id, end_date=None, start_date=None):
    """Helper: get balance per account from posted journal entries."""
    query = db.query(
        Account.id,
        Account.code,
        Account.name,
        Account.account_type,
        Account.ledger_group_id,
        LedgerGroup.name.label("ledger_group_name"),
        func.coalesce(func.sum(JournalEntryLine.debit), 0).label("total_debit"),
        func.coalesce(func.sum(JournalEntryLine.credit), 0).label("total_credit"),
    ).outerjoin(
        JournalEntryLine, (JournalEntryLine.account_id == Account.id) & (JournalEntryLine.tenant_id == tenant_id)
    ).outerjoin(
        JournalEntry, (JournalEntryLine.journal_entry_id == JournalEntry.id) & (JournalEntry.status == "posted")
    ).outerjoin(
        LedgerGroup, LedgerGroup.id == Account.ledger_group_id
    ).filter(
        Account.tenant_id == tenant_id,
        Account.is_active == True
    )

    if start_date:
        query = query.filter(JournalEntry.date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.date <= end_date)

    query = query.group_by(Account.id, Account.code, Account.name, Account.account_type, Account.ledger_group_id, LedgerGroup.name)
    query = query.order_by(Account.code)

    results = []
    for acc_id, code, name, acc_type, group_id, group_name, td, tc in query.all():
        td = float(td or 0)
        tc = float(tc or 0)
        if acc_type in ("asset", "expense"):
            balance = td - tc
        else:
            balance = tc - td
        results.append({
            "account_id": acc_id,
            "code": code,
            "name": name,
            "account_type": acc_type,
            "ledger_group_id": group_id,
            "ledger_group_name": group_name,
            "debit": round(td, 2),
            "credit": round(tc, 2),
            "balance": round(balance, 2),
        })
    return results


@router.get("/reports/trial-balance")
def get_trial_balance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Trial Balance: debit and credit totals per account."""
    try:
        accounts = _get_account_balances(db, tenant.id, end_date, start_date)
        total_debit = sum(a["debit"] for a in accounts)
        total_credit = sum(a["credit"] for a in accounts)
        return {
            "accounts": [a for a in accounts if a["debit"] > 0 or a["credit"] > 0],
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "is_balanced": abs(total_debit - total_credit) < 0.01,
        }
    except Exception as e:
        logger.error(f"Error in get_trial_balance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/income-statement")
def get_income_statement(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Income Statement (Profit & Loss): revenue minus expenses."""
    try:
        accounts = _get_account_balances(db, tenant.id, end_date, start_date)

        income_accounts = [a for a in accounts if a["account_type"] == "income" and a["balance"] != 0]
        expense_accounts = [a for a in accounts if a["account_type"] == "expense" and a["balance"] != 0]

        total_income = sum(a["balance"] for a in income_accounts)
        total_expenses = sum(a["balance"] for a in expense_accounts)
        net_income = total_income - total_expenses

        return {
            "income": income_accounts,
            "expenses": expense_accounts,
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "net_income": round(net_income, 2),
        }
    except Exception as e:
        logger.error(f"Error in get_income_statement: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/balance-sheet")
def get_balance_sheet(
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Balance Sheet: Assets = Liabilities + Equity (at a point in time)."""
    try:
        accounts = _get_account_balances(db, tenant.id, end_date)

        asset_accounts = [a for a in accounts if a["account_type"] == "asset" and a["balance"] != 0]
        liability_accounts = [a for a in accounts if a["account_type"] == "liability" and a["balance"] != 0]
        equity_accounts = [a for a in accounts if a["account_type"] == "equity" and a["balance"] != 0]

        total_assets = sum(a["balance"] for a in asset_accounts)
        total_liabilities = sum(a["balance"] for a in liability_accounts)
        total_equity = sum(a["balance"] for a in equity_accounts)

        income_accounts = [a for a in accounts if a["account_type"] == "income"]
        expense_accounts = [a for a in accounts if a["account_type"] == "expense"]
        retained_earnings = sum(a["balance"] for a in income_accounts) - sum(a["balance"] for a in expense_accounts)

        total_equity_with_retained = total_equity + retained_earnings

        return {
            "assets": asset_accounts,
            "liabilities": liability_accounts,
            "equity": equity_accounts,
            "total_assets": round(total_assets, 2),
            "total_liabilities": round(total_liabilities, 2),
            "total_equity": round(total_equity, 2),
            "retained_earnings": round(retained_earnings, 2),
            "total_equity_with_retained": round(total_equity_with_retained, 2),
            "total_liabilities_and_equity": round(total_liabilities + total_equity_with_retained, 2),
            "is_balanced": abs(total_assets - (total_liabilities + total_equity_with_retained)) < 0.01,
        }
    except Exception as e:
        logger.error(f"Error in get_balance_sheet: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/cash-flow")
def get_cash_flow(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Cash Flow: changes in cash/bank accounts over a period."""
    try:
        cash_accounts = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.account_type == "asset",
            Account.code.in_(["1000", "1100"]),
            Account.is_active == True
        ).all()

        cash_flows = []
        total_inflow = 0.0
        total_outflow = 0.0

        for account in cash_accounts:
            lines_query = db.query(
                JournalEntryLine, JournalEntry
            ).join(
                JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
            ).filter(
                JournalEntryLine.account_id == account.id,
                JournalEntryLine.tenant_id == tenant.id,
                JournalEntry.status == "posted"
            )
            if start_date:
                lines_query = lines_query.filter(JournalEntry.date >= start_date)
            if end_date:
                lines_query = lines_query.filter(JournalEntry.date <= end_date)

            lines_query = lines_query.order_by(JournalEntry.date)

            transactions = []
            for line, entry in lines_query.all():
                flow = line.debit - line.credit
                if flow > 0:
                    total_inflow += flow
                else:
                    total_outflow += abs(flow)
                transactions.append({
                    "date": str(entry.date),
                    "entry_number": entry.entry_number,
                    "description": entry.description,
                    "reference": entry.reference,
                    "reference_type": entry.reference_type,
                    "inflow": round(line.debit, 2),
                    "outflow": round(line.credit, 2),
                    "net": round(flow, 2),
                })

            inflow = sum(t["inflow"] for t in transactions)
            outflow = sum(t["outflow"] for t in transactions)
            cash_flows.append({
                "account_id": account.id,
                "account_code": account.code,
                "account_name": account.name,
                "inflow": round(inflow, 2),
                "outflow": round(outflow, 2),
                "net_change": round(inflow - outflow, 2),
                "transactions": transactions,
            })

        return {
            "cash_accounts": cash_flows,
            "total_inflow": round(total_inflow, 2),
            "total_outflow": round(total_outflow, 2),
            "net_change": round(total_inflow - total_outflow, 2),
        }
    except Exception as e:
        logger.error(f"Error in get_cash_flow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# COST CENTERS
# ============================================

@router.get("/cost-centers", response_model=List[CostCenterResponse])
def get_cost_centers(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """List cost centers for the current tenant."""
    query = db.query(CostCenter).filter(CostCenter.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(CostCenter.is_active == is_active)
    return query.order_by(CostCenter.code).all()


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
def create_cost_center(
    data: CostCenterCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a cost center (admin only)."""
    existing = db.query(CostCenter).filter(
        CostCenter.tenant_id == tenant.id, CostCenter.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A cost center with this code already exists")

    if data.parent_id:
        parent = db.query(CostCenter).filter(
            CostCenter.id == data.parent_id, CostCenter.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent cost center not found")

    cc = CostCenter(**data.model_dump(), tenant_id=tenant.id)
    db.add(cc)
    db.commit()
    db.refresh(cc)
    return cc


@router.put("/cost-centers/{cost_center_id}", response_model=CostCenterResponse)
def update_cost_center(
    cost_center_id: int,
    data: CostCenterUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a cost center (admin only)."""
    cc = db.query(CostCenter).filter(
        CostCenter.id == cost_center_id, CostCenter.tenant_id == tenant.id
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cc, key, value)

    db.commit()
    db.refresh(cc)
    return cc


@router.delete("/cost-centers/{cost_center_id}")
def deactivate_cost_center(
    cost_center_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate a cost center (admin only). Kept for historical reporting, not deleted."""
    cc = db.query(CostCenter).filter(
        CostCenter.id == cost_center_id, CostCenter.tenant_id == tenant.id
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")

    cc.is_active = False
    db.commit()
    return {"message": "Cost center deactivated successfully"}


@router.get("/cost-centers/{cost_center_id}/spend")
def get_cost_center_spend(
    cost_center_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Actual spend posted against a cost center, compared to its budget."""
    cc = db.query(CostCenter).filter(
        CostCenter.id == cost_center_id, CostCenter.tenant_id == tenant.id
    ).first()
    if not cc:
        raise HTTPException(status_code=404, detail="Cost center not found")

    query = db.query(JournalEntryLine).join(
        JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
    ).filter(
        JournalEntryLine.cost_center_id == cost_center_id,
        JournalEntryLine.tenant_id == tenant.id,
        JournalEntry.status == "posted",
    )
    if start_date:
        query = query.filter(JournalEntry.date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.date <= end_date)

    lines = query.all()
    actual_spend = sum(line.debit - line.credit for line in lines)
    budget = cc.budget_amount or 0

    return {
        "cost_center_id": cc.id,
        "code": cc.code,
        "name": cc.name,
        "budget_amount": budget,
        "actual_spend": round(actual_spend, 2),
        "variance": round(budget - actual_spend, 2),
        "utilization_pct": round((actual_spend / budget * 100), 1) if budget else None,
        "transaction_count": len(lines),
    }


# ============================================
# LEDGER GROUPS
# ============================================

@router.get("/ledger-groups/tree", response_model=List[LedgerGroupTreeResponse])
def get_ledger_group_tree(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Ledger groups as a tree, each node's balance rolled up from its own accounts plus all descendant groups."""
    balances = db.query(
        Account.id, Account.ledger_group_id, Account.account_type,
        func.coalesce(func.sum(JournalEntryLine.debit), 0).label("total_debit"),
        func.coalesce(func.sum(JournalEntryLine.credit), 0).label("total_credit"),
    ).outerjoin(
        JournalEntryLine, (JournalEntryLine.account_id == Account.id) & (JournalEntryLine.tenant_id == tenant.id)
    ).outerjoin(
        JournalEntry, (JournalEntryLine.journal_entry_id == JournalEntry.id) & (JournalEntry.status == "posted")
    ).filter(
        Account.tenant_id == tenant.id, Account.is_active == True
    )
    if start_date:
        balances = balances.filter(JournalEntry.date >= start_date)
    if end_date:
        balances = balances.filter(JournalEntry.date <= end_date)
    balances = balances.group_by(Account.id, Account.ledger_group_id, Account.account_type).all()

    account_count_by_group: dict = {}
    debit_by_group: dict = {}
    credit_by_group: dict = {}
    for acc_id, group_id, acc_type, td, tc in balances:
        if group_id is None:
            continue
        account_count_by_group[group_id] = account_count_by_group.get(group_id, 0) + 1
        debit_by_group[group_id] = debit_by_group.get(group_id, 0) + float(td or 0)
        credit_by_group[group_id] = credit_by_group.get(group_id, 0) + float(tc or 0)

    all_groups = db.query(LedgerGroup).filter(LedgerGroup.tenant_id == tenant.id).order_by(LedgerGroup.sort_order, LedgerGroup.code).all()
    children_map: dict = {}
    for g in all_groups:
        children_map.setdefault(g.parent_id, []).append(g)

    def rollup(group_id):
        """Sum own accounts + all descendant groups' accounts."""
        debit = debit_by_group.get(group_id, 0)
        credit = credit_by_group.get(group_id, 0)
        count = account_count_by_group.get(group_id, 0)
        for child in children_map.get(group_id, []):
            cd, cc_, ccount = rollup(child.id)
            debit += cd
            credit += cc_
            count += ccount
        return debit, credit, count

    def build(group: LedgerGroup) -> LedgerGroupTreeResponse:
        debit, credit, count = rollup(group.id)
        balance = debit - credit if group.nature in ("asset", "expense") else credit - debit
        return LedgerGroupTreeResponse(
            id=group.id, tenant_id=group.tenant_id, code=group.code, name=group.name,
            parent_id=group.parent_id, nature=group.nature, color=group.color, icon=group.icon,
            sort_order=group.sort_order, is_active=group.is_active,
            created_at=group.created_at, updated_at=group.updated_at,
            account_count=count, total_debit=round(debit, 2), total_credit=round(credit, 2), balance=round(balance, 2),
            children=[build(child) for child in children_map.get(group.id, [])],
        )

    roots = children_map.get(None, [])
    return [build(g) for g in roots]


@router.get("/ledger-groups", response_model=List[LedgerGroupResponse])
def get_ledger_groups(
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Flat list of ledger groups for the current tenant."""
    query = db.query(LedgerGroup).filter(LedgerGroup.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(LedgerGroup.is_active == is_active)
    if search:
        query = query.filter((LedgerGroup.code.contains(search)) | (LedgerGroup.name.contains(search)))
    return query.order_by(LedgerGroup.sort_order, LedgerGroup.code).all()


@router.post("/ledger-groups", response_model=LedgerGroupResponse, status_code=status.HTTP_201_CREATED)
def create_ledger_group(
    data: LedgerGroupCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a ledger group (admin only)."""
    existing = db.query(LedgerGroup).filter(
        LedgerGroup.tenant_id == tenant.id, LedgerGroup.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A ledger group with this code already exists")

    if data.parent_id:
        parent = db.query(LedgerGroup).filter(
            LedgerGroup.id == data.parent_id, LedgerGroup.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent ledger group not found")

    group = LedgerGroup(**data.model_dump(), tenant_id=tenant.id)
    db.add(group)
    db.flush()
    record_audit_log(db, tenant.id, current_user.id, "create", "ledger_group", group.id,
                      details=f"Created ledger group {group.code} - {group.name}")
    db.commit()
    db.refresh(group)
    return group


@router.put("/ledger-groups/{group_id}", response_model=LedgerGroupResponse)
def update_ledger_group(
    group_id: int,
    data: LedgerGroupUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a ledger group, including reparenting for drag-and-drop reorganization (admin only)."""
    group = db.query(LedgerGroup).filter(
        LedgerGroup.id == group_id, LedgerGroup.tenant_id == tenant.id
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Ledger group not found")

    update_data = data.model_dump(exclude_unset=True)

    if "code" in update_data and update_data["code"] != group.code:
        existing = db.query(LedgerGroup).filter(
            LedgerGroup.code == update_data["code"], LedgerGroup.tenant_id == tenant.id,
            LedgerGroup.id != group_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A ledger group with this code already exists")

    if "parent_id" in update_data and update_data["parent_id"]:
        if update_data["parent_id"] == group_id:
            raise HTTPException(status_code=400, detail="A ledger group cannot be its own parent")
        parent = db.query(LedgerGroup).filter(
            LedgerGroup.id == update_data["parent_id"], LedgerGroup.tenant_id == tenant.id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent ledger group not found")
        # Prevent cycles: walk up the proposed parent's ancestry looking for this group.
        ancestor = parent
        while ancestor:
            if ancestor.id == group_id:
                raise HTTPException(status_code=400, detail="Cannot move a group under its own descendant")
            ancestor = ancestor.parent

    for key, value in update_data.items():
        setattr(group, key, value)

    record_audit_log(db, tenant.id, current_user.id, "update", "ledger_group", group.id,
                      details=f"Updated ledger group {group.code}")
    db.commit()
    db.refresh(group)
    return group


@router.delete("/ledger-groups/{group_id}")
def delete_ledger_group(
    group_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a ledger group (admin only). Blocked if it has sub-groups or assigned accounts."""
    group = db.query(LedgerGroup).filter(
        LedgerGroup.id == group_id, LedgerGroup.tenant_id == tenant.id
    ).first()
    if not group:
        raise HTTPException(status_code=404, detail="Ledger group not found")

    child_count = db.query(LedgerGroup).filter(LedgerGroup.parent_id == group_id).count()
    if child_count:
        raise HTTPException(status_code=400, detail="Cannot delete a group that has sub-groups. Move or delete them first.")

    account_count = db.query(Account).filter(Account.ledger_group_id == group_id, Account.tenant_id == tenant.id).count()
    if account_count:
        raise HTTPException(status_code=400, detail="Cannot delete a group with ledgers assigned to it. Reassign them first.")

    record_audit_log(db, tenant.id, current_user.id, "delete", "ledger_group", group_id,
                      details=f"Deleted ledger group {group.code}")
    db.delete(group)
    db.commit()
    return {"message": "Ledger group deleted successfully"}


# ============================================
# TAX RATES
# ============================================

@router.get("/tax-rates", response_model=List[TaxRateResponse])
def get_tax_rates(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """List tax rates for the current tenant."""
    query = db.query(TaxRate).filter(TaxRate.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(TaxRate.is_active == is_active)
    return query.order_by(TaxRate.name).all()


@router.post("/tax-rates", response_model=TaxRateResponse, status_code=status.HTTP_201_CREATED)
def create_tax_rate(
    data: TaxRateCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a tax rate (admin only)."""
    tr = TaxRate(**data.model_dump(), tenant_id=tenant.id)
    db.add(tr)
    db.commit()
    db.refresh(tr)
    return tr


@router.put("/tax-rates/{tax_rate_id}", response_model=TaxRateResponse)
def update_tax_rate(
    tax_rate_id: int,
    data: TaxRateUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a tax rate (admin only)."""
    tr = db.query(TaxRate).filter(TaxRate.id == tax_rate_id, TaxRate.tenant_id == tenant.id).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Tax rate not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(tr, key, value)

    db.commit()
    db.refresh(tr)
    return tr


@router.delete("/tax-rates/{tax_rate_id}")
def deactivate_tax_rate(
    tax_rate_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate a tax rate (admin only)."""
    tr = db.query(TaxRate).filter(TaxRate.id == tax_rate_id, TaxRate.tenant_id == tenant.id).first()
    if not tr:
        raise HTTPException(status_code=404, detail="Tax rate not found")

    tr.is_active = False
    db.commit()
    return {"message": "Tax rate deactivated successfully"}


@router.get("/reports/tax-summary")
def get_tax_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """GST/tax summary: total taxable value and tax collected per tax rate, from posted vouchers."""
    query = db.query(JournalEntryLine).join(
        JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
    ).filter(
        JournalEntryLine.tenant_id == tenant.id,
        JournalEntryLine.tax_rate_id.isnot(None),
        JournalEntry.status == "posted",
    )
    if start_date:
        query = query.filter(JournalEntry.date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.date <= end_date)

    summary: dict = {}
    for line in query.all():
        tr = line.tax_rate
        key = tr.id
        if key not in summary:
            summary[key] = {
                "tax_rate_id": tr.id, "name": tr.name, "tax_type": tr.tax_type,
                "rate": tr.rate, "taxable_lines": 0, "tax_amount": 0.0,
            }
        summary[key]["taxable_lines"] += 1
        summary[key]["tax_amount"] += line.debit + line.credit

    rows = list(summary.values())
    for row in rows:
        row["tax_amount"] = round(row["tax_amount"], 2)

    return {
        "rows": rows,
        "total_tax": round(sum(r["tax_amount"] for r in rows), 2),
    }


# ============================================
# BANK RECONCILIATION
# ============================================

@router.get("/reconciliation/{account_id}", response_model=ReconciliationStatusResponse)
def get_reconciliation_status(
    account_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Unreconciled posted lines for a cash/bank account, plus the current book balance."""
    account = db.query(Account).filter(
        Account.id == account_id, Account.tenant_id == tenant.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    all_posted = db.query(JournalEntryLine).join(
        JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
    ).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntryLine.tenant_id == tenant.id,
        JournalEntry.status == "posted",
    ).all()

    book_balance = sum(line.debit - line.credit for line in all_posted)
    reconciled_balance = sum(line.debit - line.credit for line in all_posted if line.is_reconciled)

    unreconciled = db.query(JournalEntryLine).options(joinedload(JournalEntryLine.journal_entry)).join(
        JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
    ).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntryLine.tenant_id == tenant.id,
        JournalEntry.status == "posted",
        JournalEntryLine.is_reconciled == False,
    ).order_by(JournalEntry.date).all()

    return {
        "account_id": account.id,
        "account_code": account.code,
        "account_name": account.name,
        "book_balance": round(book_balance, 2),
        "reconciled_balance": round(reconciled_balance, 2),
        "unreconciled_lines": [
            {
                "id": line.id,
                "date": line.journal_entry.date,
                "entry_number": line.journal_entry.entry_number,
                "voucher_type": line.journal_entry.voucher_type,
                "description": line.description or line.journal_entry.description,
                "reference": line.journal_entry.reference,
                "debit": line.debit,
                "credit": line.credit,
            }
            for line in unreconciled
        ],
    }


@router.post("/reconciliation/{account_id}", response_model=BankReconciliationResponse, status_code=status.HTTP_201_CREATED)
def reconcile_account(
    account_id: int,
    data: ReconcileRequest,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Mark the given lines as reconciled against a bank statement and record the session."""
    account = db.query(Account).filter(
        Account.id == account_id, Account.tenant_id == tenant.id
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    lines = db.query(JournalEntryLine).filter(
        JournalEntryLine.id.in_(data.line_ids),
        JournalEntryLine.account_id == account_id,
        JournalEntryLine.tenant_id == tenant.id,
    ).all()
    if len(lines) != len(data.line_ids):
        raise HTTPException(status_code=404, detail="One or more lines not found for this account")

    now = datetime.utcnow()
    for line in lines:
        line.is_reconciled = True
        line.reconciled_at = now

    all_posted = db.query(JournalEntryLine).join(
        JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
    ).filter(
        JournalEntryLine.account_id == account_id,
        JournalEntryLine.tenant_id == tenant.id,
        JournalEntry.status == "posted",
    ).all()
    book_balance = sum(l.debit - l.credit for l in all_posted)
    difference = round(data.statement_balance - book_balance, 2)

    record = BankReconciliation(
        tenant_id=tenant.id,
        account_id=account_id,
        statement_date=data.statement_date,
        statement_balance=data.statement_balance,
        book_balance=round(book_balance, 2),
        difference=difference,
        notes=data.notes,
        reconciled_by=current_user.id,
    )
    db.add(record)

    record_audit_log(db, tenant.id, current_user.id, "reconcile", "account", account.id,
                      f"Reconciled {account.name} against statement dated {data.statement_date} "
                      f"({len(lines)} line(s), difference {difference:.2f})")

    db.commit()
    db.refresh(record)
    return record


@router.get("/reconciliation/{account_id}/history", response_model=List[BankReconciliationResponse])
def get_reconciliation_history(
    account_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Past reconciliation sessions for an account, most recent first."""
    return db.query(BankReconciliation).filter(
        BankReconciliation.account_id == account_id,
        BankReconciliation.tenant_id == tenant.id,
    ).order_by(BankReconciliation.statement_date.desc()).all()


# ============================================
# RATIO ANALYSIS (MIS)
# ============================================

@router.get("/reports/ratio-analysis")
def get_ratio_analysis(
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Standard audit ratios computed from posted entries: liquidity, profitability, solvency."""
    try:
        balances = _get_account_balances(db, tenant.id, end_date=end_date)
        accounts_by_type: dict = {}
        for row in balances:
            accounts_by_type.setdefault(row["account_type"], []).append(row)

        def total(account_type, code_prefixes=None):
            rows = accounts_by_type.get(account_type, [])
            if code_prefixes:
                rows = [r for r in rows if any(r["code"].startswith(p) for p in code_prefixes)]
            return sum(r["balance"] for r in rows)

        total_assets = total("asset")
        # Current assets/liabilities: accounts coded 1xxx (current) vs 2xxx+ by convention in this
        # chart of accounts; falls back to treating everything as current if that convention isn't used.
        current_assets = total("asset", ["1"])
        current_liabilities = total("liability", ["2"])
        total_liabilities = total("liability")
        total_equity = total("equity")
        total_income = total("income")
        total_expense = total("expense")
        net_profit = total_income - total_expense
        cash_and_bank = sum(
            r["balance"] for r in accounts_by_type.get("asset", [])
            if r["code"] in ("1000", "1100")
        )

        def safe_div(a, b):
            return round(a / b, 2) if b else None

        return {
            "as_of": end_date,
            "current_ratio": safe_div(current_assets, current_liabilities),
            "quick_ratio": safe_div(cash_and_bank, current_liabilities),
            "debt_to_equity": safe_div(total_liabilities, total_equity),
            "gross_profit_margin_pct": safe_div(net_profit * 100, total_income),
            "net_profit_margin_pct": safe_div(net_profit * 100, total_income),
            "return_on_equity_pct": safe_div(net_profit * 100, total_equity),
            "totals": {
                "total_assets": round(total_assets, 2),
                "total_liabilities": round(total_liabilities, 2),
                "total_equity": round(total_equity, 2),
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "net_profit": round(net_profit, 2),
            },
        }
    except Exception as e:
        logger.error(f"Error in get_ratio_analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _age_bucket(days: int) -> str:
    if days <= 0:
        return "current"
    if days <= 30:
        return "1-30"
    if days <= 60:
        return "31-60"
    if days <= 90:
        return "61-90"
    return "90+"


@router.get("/reports/receivables")
def get_receivables_aging(
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Accounts Receivable aging: outstanding customer invoices bucketed by days past due."""
    try:
        invoices = db.query(Invoice).filter(
            Invoice.tenant_id == tenant.id,
            Invoice.status.in_(["sent", "overdue", "partially_paid"]),
        ).order_by(Invoice.due_date).all()

        today = date.today()
        rows = []
        buckets = {"current": 0.0, "1-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        total_outstanding = 0.0

        for inv in invoices:
            outstanding = round((inv.total_amount or 0) - (inv.amount_paid or 0), 2)
            if outstanding <= 0:
                continue
            days_overdue = (today - inv.due_date).days
            bucket = _age_bucket(days_overdue)
            buckets[bucket] += outstanding
            total_outstanding += outstanding
            rows.append({
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": inv.customer_name,
                "due_date": inv.due_date.isoformat(),
                "total_amount": inv.total_amount,
                "amount_paid": inv.amount_paid,
                "outstanding": outstanding,
                "days_overdue": days_overdue,
                "bucket": bucket,
            })

        return {
            "as_of": today.isoformat(),
            "invoices": rows,
            "buckets": {k: round(v, 2) for k, v in buckets.items()},
            "total_outstanding": round(total_outstanding, 2),
        }
    except Exception as e:
        logger.error(f"Error in get_receivables_aging: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/payables")
def get_payables_aging(
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Accounts Payable aging: approved-but-unpaid expense claims, aged by days since approval.

    This system has no vendor-bill entity with its own due date, so payables here are
    accounting-approved expense claims awaiting payment - a real, if narrower, payable set.
    """
    try:
        claims = db.query(ExpenseClaim).filter(
            ExpenseClaim.tenant_id == tenant.id,
            ExpenseClaim.status == "accounting_approved",
            ExpenseClaim.paid_at.is_(None),
        ).order_by(ExpenseClaim.accounting_approved_at).all()

        today = date.today()
        rows = []
        buckets = {"current": 0.0, "1-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
        total_outstanding = 0.0

        for claim in claims:
            approved_date = claim.accounting_approved_at.date() if claim.accounting_approved_at else claim.date
            days_pending = (today - approved_date).days
            bucket = _age_bucket(days_pending)
            amount = claim.total_amount or 0
            buckets[bucket] += amount
            total_outstanding += amount
            employee = claim.employee
            rows.append({
                "claim_id": claim.id,
                "claim_number": claim.claim_number,
                "employee_name": f"{employee.first_name} {employee.last_name}" if employee else None,
                "approved_date": approved_date.isoformat(),
                "amount": amount,
                "days_pending": days_pending,
                "bucket": bucket,
            })

        return {
            "as_of": today.isoformat(),
            "claims": rows,
            "buckets": {k: round(v, 2) for k, v in buckets.items()},
            "total_outstanding": round(total_outstanding, 2),
        }
    except Exception as e:
        logger.error(f"Error in get_payables_aging: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
