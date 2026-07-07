"""
Budget actuals - computes "what was actually spent/earned" for a budget's
scope and period from the data that already represents ground truth (posted
journal lines, expense claims, invoices), rather than a separate figure that
could drift out of sync with the real books.

Scope -> actual source:
  company     -> all posted JournalEntryLine activity (tenant-wide), optionally
                 narrowed to one account
  cost_center -> same, filtered to JournalEntryLine.cost_center_id
  project     -> Invoice.total_amount for invoices tagged to that project
                 (the only project-linked financial entity in this system)
  employee    -> ExpenseClaim.total_amount for that employee's accounting-approved
                 or paid claims (the only employee-linked financial entity)
"""
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models.accounting import JournalEntry, JournalEntryLine, Account
from ..models.invoice import Invoice
from ..models.expense import ExpenseClaim
from ..models.budget import Budget


def compute_actual(db: Session, tenant_id: int, budget: Budget, period_start: date, period_end: date) -> float:
    if budget.scope_type in ("company", "cost_center"):
        query = db.query(
            func.coalesce(func.sum(JournalEntryLine.debit), 0),
            func.coalesce(func.sum(JournalEntryLine.credit), 0),
        ).join(
            JournalEntry, JournalEntryLine.journal_entry_id == JournalEntry.id
        ).filter(
            JournalEntryLine.tenant_id == tenant_id,
            JournalEntry.status == "posted",
            JournalEntry.date >= period_start,
            JournalEntry.date <= period_end,
        )
        if budget.scope_type == "cost_center":
            query = query.filter(JournalEntryLine.cost_center_id == budget.scope_id)
        if budget.account_id:
            query = query.filter(JournalEntryLine.account_id == budget.account_id)

        debit, credit = query.first()
        debit, credit = float(debit or 0), float(credit or 0)

        # Expense/asset accounts are debit-normal; without a specific account we
        # can't know the normal side, so fall back to net debit activity (the
        # common case for a spend budget).
        if budget.account_id:
            account = db.query(Account).filter(Account.id == budget.account_id).first()
            if account and account.account_type in ("income", "liability", "equity"):
                return round(credit - debit, 2)
        return round(debit - credit, 2)

    if budget.scope_type == "project":
        total = db.query(func.coalesce(func.sum(Invoice.total_amount), 0)).filter(
            Invoice.tenant_id == tenant_id,
            Invoice.project_id == budget.scope_id,
            Invoice.status != "draft",
            Invoice.issue_date >= period_start,
            Invoice.issue_date <= period_end,
        ).scalar()
        return round(float(total or 0), 2)

    if budget.scope_type == "employee":
        total = db.query(func.coalesce(func.sum(ExpenseClaim.total_amount), 0)).filter(
            ExpenseClaim.tenant_id == tenant_id,
            ExpenseClaim.employee_id == budget.scope_id,
            ExpenseClaim.status.in_(["accounting_approved", "paid"]),
            ExpenseClaim.date >= period_start,
            ExpenseClaim.date <= period_end,
        ).scalar()
        return round(float(total or 0), 2)

    return 0.0


def variance_status(budgeted: float, actual: float) -> str:
    if budgeted <= 0:
        return "on_track" if actual <= 0 else "over"
    ratio = actual / budgeted
    if ratio > 1.0:
        return "over"
    if ratio >= 0.9:
        return "on_track"
    return "under"


def get_scope_label(db: Session, tenant_id: int, scope_type: str, scope_id: Optional[int]) -> Optional[str]:
    if scope_type == "company" or scope_id is None:
        return None
    if scope_type == "cost_center":
        from ..models.accounting import CostCenter
        cc = db.query(CostCenter).filter(CostCenter.id == scope_id, CostCenter.tenant_id == tenant_id).first()
        return f"{cc.code} - {cc.name}" if cc else f"Cost Center #{scope_id}"
    if scope_type == "project":
        from ..models.project import Project
        p = db.query(Project).filter(Project.id == scope_id, Project.tenant_id == tenant_id).first()
        return p.name if p else f"Project #{scope_id}"
    if scope_type == "employee":
        from ..models.employee import Employee
        e = db.query(Employee).filter(Employee.id == scope_id, Employee.tenant_id == tenant_id).first()
        return f"{e.first_name} {e.last_name}" if e else f"Employee #{scope_id}"
    return None
