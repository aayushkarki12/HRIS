import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime

from ...core.database import get_db
from ...core.dependencies import (
    get_current_active_user, get_current_admin_user,
    get_current_tenant, get_current_employee, get_current_manager_user
)
from ...core.audit import record_audit_log
from ...core.notifications import notify_user
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.expense import ExpenseClaim, ExpenseClaimLine
from ...models.accounting import Account, JournalEntry, JournalEntryLine
from ...schemas.expense import (
    ExpenseClaimCreate, ExpenseClaimUpdate, ExpenseClaimResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/expenses", tags=["expenses"])

# ============================================
# STATIC ROUTES FIRST
# ============================================

@router.get("/my", response_model=List[ExpenseClaimResponse])
def get_my_expenses(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get current employee's expense claims."""
    try:
        return db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.employee_id == current_employee.id,
            ExpenseClaim.tenant_id == tenant.id
        ).order_by(ExpenseClaim.created_at.desc()).all()
    except Exception as e:
        logger.error(f"Error in get_my_expenses: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending", response_model=List[ExpenseClaimResponse])
def get_pending_expenses(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get pending expense claims for approval."""
    try:
        query = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(ExpenseClaim.tenant_id == tenant.id)

        if current_user.role == "manager":
            query = query.filter(ExpenseClaim.status == "submitted")
        elif current_user.role == "admin":
            query = query.filter(ExpenseClaim.status.in_(["submitted", "manager_approved"]))
        else:
            return []

        return query.order_by(ExpenseClaim.submitted_at.desc()).all()
    except Exception as e:
        logger.error(f"Error in get_pending_expenses: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[ExpenseClaimResponse])
def get_all_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all expense claims (admin/manager view)."""
    try:
        query = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(ExpenseClaim.tenant_id == tenant.id)

        if current_user.role not in ["admin", "manager"]:
            employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if employee:
                query = query.filter(ExpenseClaim.employee_id == employee.id)
            else:
                return []

        if status_filter:
            query = query.filter(ExpenseClaim.status == status_filter)

        return query.order_by(ExpenseClaim.created_at.desc()).offset(skip).limit(limit).all()
    except Exception as e:
        logger.error(f"Error in get_all_expenses: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ExpenseClaimResponse, status_code=status.HTTP_201_CREATED)
def create_expense_claim(
    data: ExpenseClaimCreate,
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new expense claim."""
    try:
        claim_count = db.query(ExpenseClaim).filter(
            ExpenseClaim.tenant_id == tenant.id
        ).count()
        claim_number = f"EXP-{claim_count + 1:04d}"

        total_amount = sum(line.amount for line in data.lines)

        db_claim = ExpenseClaim(
            claim_number=claim_number,
            employee_id=current_employee.id,
            date=data.date,
            description=data.description,
            total_amount=round(total_amount, 2),
            status="draft",
            tenant_id=tenant.id,
        )
        db.add(db_claim)
        db.flush()

        for line_data in data.lines:
            db_line = ExpenseClaimLine(
                expense_claim_id=db_claim.id,
                description=line_data.description,
                amount=line_data.amount,
                category=line_data.category,
                receipt_url=line_data.receipt_url,
                tenant_id=tenant.id,
            )
            db.add(db_line)

        db.commit()

        result = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(ExpenseClaim.id == db_claim.id).first()
        return result
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DYNAMIC ROUTES
# ============================================

@router.get("/{claim_id}", response_model=ExpenseClaimResponse)
def get_expense_claim(
    claim_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get expense claim by ID."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")

        if current_user.role not in ["admin", "manager"]:
            employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if not employee or claim.employee_id != employee.id:
                raise HTTPException(status_code=403, detail="Not authorized")

        return claim
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{claim_id}/submit", response_model=ExpenseClaimResponse)
def submit_expense_claim(
    claim_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Submit a draft expense claim for approval."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status != "draft":
            raise HTTPException(status_code=400, detail="Only draft claims can be submitted")

        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or claim.employee_id != employee.id:
            if current_user.role not in ["admin"]:
                raise HTTPException(status_code=403, detail="Not authorized")

        claim.status = "submitted"
        claim.submitted_at = datetime.now()
        db.commit()
        db.refresh(claim)
        return claim
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in submit_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{claim_id}/manager-approve", response_model=ExpenseClaimResponse)
def manager_approve_expense(
    claim_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Manager approves an expense claim."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status != "submitted":
            raise HTTPException(status_code=400, detail="Only submitted claims can be manager-approved")

        claim.status = "manager_approved"
        claim.manager_approved_by = current_user.id
        claim.manager_approved_at = datetime.now()
        record_audit_log(db, tenant.id, current_user.id, "manager_approve", "expense_claim", claim.id,
                          f"Manager approved {claim.claim_number} ({claim.total_amount})")
        db.commit()
        db.refresh(claim)
        return claim
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in manager_approve_expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{claim_id}/accounting-approve", response_model=ExpenseClaimResponse)
def accounting_approve_expense(
    claim_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Accounting (admin) approves an expense claim."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status != "manager_approved":
            raise HTTPException(status_code=400, detail="Claim must be manager-approved first")

        claim.status = "accounting_approved"
        claim.accounting_approved_by = current_user.id
        claim.accounting_approved_at = datetime.now()
        record_audit_log(db, tenant.id, current_user.id, "accounting_approve", "expense_claim", claim.id,
                          f"Accounting approved {claim.claim_number} ({claim.total_amount})")
        db.commit()
        db.refresh(claim)
        return claim
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in accounting_approve_expense: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{claim_id}/pay", response_model=ExpenseClaimResponse)
def pay_expense_claim(
    claim_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Mark expense claim as paid and create journal entry."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status != "accounting_approved":
            raise HTTPException(status_code=400, detail="Claim must be accounting-approved before payment")

        expense_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code == "5200",
            Account.is_active == True
        ).first()
        cash_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["1000", "1100"]),
            Account.is_active == True
        ).first()

        if not expense_account or not cash_account:
            raise HTTPException(
                status_code=400,
                detail="Accounting accounts not set up. Need 5200 (Office Supplies/Expense) and 1000/1100 (Cash/Bank)."
            )

        entry_count = db.query(JournalEntry).filter(
            JournalEntry.tenant_id == tenant.id
        ).count()
        entry_number = f"JE-{entry_count + 1:04d}"

        db_entry = JournalEntry(
            entry_number=entry_number,
            date=claim.date,
            description=f"Expense claim {claim.claim_number}: {claim.description}",
            reference=claim.claim_number,
            reference_type="expense",
            status="posted",
            posted_by=current_user.id,
            posted_at=datetime.now(),
            tenant_id=tenant.id,
        )
        db.add(db_entry)
        db.flush()

        db.add(JournalEntryLine(
            journal_entry_id=db_entry.id,
            account_id=expense_account.id,
            description=f"Expense reimbursement - {claim.claim_number}",
            debit=claim.total_amount,
            credit=0,
            tenant_id=tenant.id,
        ))
        db.add(JournalEntryLine(
            journal_entry_id=db_entry.id,
            account_id=cash_account.id,
            description=f"Payment for expense claim {claim.claim_number}",
            debit=0,
            credit=claim.total_amount,
            tenant_id=tenant.id,
        ))

        claim.status = "paid"
        claim.paid_at = datetime.now()
        claim.journal_entry_id = db_entry.id

        record_audit_log(db, tenant.id, current_user.id, "pay", "expense_claim", claim.id,
                          f"Paid {claim.claim_number} ({claim.total_amount})")

        claim_employee = db.query(Employee).filter(Employee.id == claim.employee_id).first()
        if claim_employee and claim_employee.user_id:
            notify_user(
                db, tenant.id, claim_employee.user_id,
                title="Expense claim paid",
                message=f"Your expense claim {claim.claim_number} for {claim.total_amount} has been approved and paid.",
                entity_type="expense_claim", entity_id=claim.id,
            )

        db.commit()

        result = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(ExpenseClaim.id == claim.id).first()
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in pay_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{claim_id}/reject", response_model=ExpenseClaimResponse)
def reject_expense_claim(
    claim_id: int,
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Reject an expense claim."""
    try:
        claim = db.query(ExpenseClaim).options(
            joinedload(ExpenseClaim.lines)
        ).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status not in ["submitted", "manager_approved"]:
            raise HTTPException(status_code=400, detail="Cannot reject this claim")

        claim.status = "rejected"
        claim.rejected_by = current_user.id
        claim.rejected_at = datetime.now()
        claim.rejection_reason = reason
        record_audit_log(db, tenant.id, current_user.id, "reject", "expense_claim", claim.id, reason)

        claim_employee = db.query(Employee).filter(Employee.id == claim.employee_id).first()
        if claim_employee and claim_employee.user_id:
            notify_user(
                db, tenant.id, claim_employee.user_id,
                title="Expense claim rejected",
                message=f"Your expense claim {claim.claim_number} for {claim.total_amount} was rejected." + (f" Reason: {reason}" if reason else ""),
                entity_type="expense_claim", entity_id=claim.id,
            )

        db.commit()
        db.refresh(claim)
        return claim
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in reject_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{claim_id}")
def delete_expense_claim(
    claim_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a draft expense claim."""
    try:
        claim = db.query(ExpenseClaim).filter(
            ExpenseClaim.id == claim_id,
            ExpenseClaim.tenant_id == tenant.id
        ).first()
        if not claim:
            raise HTTPException(status_code=404, detail="Expense claim not found")
        if claim.status != "draft":
            raise HTTPException(status_code=400, detail="Can only delete draft claims")

        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if current_user.role != "admin" and (not employee or claim.employee_id != employee.id):
            raise HTTPException(status_code=403, detail="Not authorized")

        db.query(ExpenseClaimLine).filter(ExpenseClaimLine.expense_claim_id == claim.id).delete()
        db.delete(claim)
        db.commit()
        return {"message": "Expense claim deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_expense_claim: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
