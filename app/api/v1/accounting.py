import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.accounting import Account, JournalEntry, JournalEntryLine
from ...schemas.accounting import (
    AccountCreate, AccountUpdate, AccountResponse, AccountTreeResponse,
    JournalEntryCreate, JournalEntryUpdate, JournalEntryResponse,
    LedgerAccountResponse, LedgerLineResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accounting", tags=["accounting"])

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

        entry_count = db.query(JournalEntry).filter(
            JournalEntry.tenant_id == tenant.id
        ).count()
        entry_number = f"JE-{entry_count + 1:04d}"

        db_entry = JournalEntry(
            entry_number=entry_number,
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
                tenant_id=tenant.id,
            )
            db.add(db_line)

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
        func.coalesce(func.sum(JournalEntryLine.debit), 0).label("total_debit"),
        func.coalesce(func.sum(JournalEntryLine.credit), 0).label("total_credit"),
    ).outerjoin(
        JournalEntryLine, (JournalEntryLine.account_id == Account.id) & (JournalEntryLine.tenant_id == tenant_id)
    ).outerjoin(
        JournalEntry, (JournalEntryLine.journal_entry_id == JournalEntry.id) & (JournalEntry.status == "posted")
    ).filter(
        Account.tenant_id == tenant_id,
        Account.is_active == True
    )

    if start_date:
        query = query.filter(JournalEntry.date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.date <= end_date)

    query = query.group_by(Account.id, Account.code, Account.name, Account.account_type)
    query = query.order_by(Account.code)

    results = []
    for acc_id, code, name, acc_type, td, tc in query.all():
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
