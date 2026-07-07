import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...core.budget_service import compute_actual, variance_status, get_scope_label
from ...models.user import User
from ...models.tenant import Tenant
from ...models.budget import Budget, BudgetPeriod
from ...schemas.budget import (
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetActionRequest,
    BudgetVarianceResponse, PeriodVariance,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/budgets", tags=["budgets"])


def _hydrate(db: Session, tenant_id: int, budget: Budget) -> Budget:
    budget.total_budgeted = round(sum(p.amount for p in budget.periods), 2)
    budget.scope_label = get_scope_label(db, tenant_id, budget.scope_type, budget.scope_id)
    return budget


@router.get("/", response_model=List[BudgetResponse])
def get_budgets(
    fiscal_year: Optional[int] = None,
    scope_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(Budget).options(joinedload(Budget.periods)).filter(Budget.tenant_id == tenant.id)
    if fiscal_year:
        query = query.filter(Budget.fiscal_year == fiscal_year)
    if scope_type:
        query = query.filter(Budget.scope_type == scope_type)
    if status_filter:
        query = query.filter(Budget.status == status_filter)
    budgets = query.order_by(Budget.fiscal_year.desc(), Budget.name).all()
    return [_hydrate(db, tenant.id, b) for b in budgets]


@router.get("/{budget_id}", response_model=BudgetResponse)
def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).options(joinedload(Budget.periods)).filter(
        Budget.id == budget_id, Budget.tenant_id == tenant.id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return _hydrate(db, tenant.id, budget)


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = Budget(
        tenant_id=tenant.id, name=data.name, fiscal_year=data.fiscal_year,
        period_type=data.period_type, scope_type=data.scope_type, scope_id=data.scope_id,
        account_id=data.account_id, notes=data.notes, status="draft", created_by=current_user.id,
    )
    db.add(budget)
    db.flush()

    for period in data.periods:
        db.add(BudgetPeriod(
            budget_id=budget.id, tenant_id=tenant.id, period_label=period.period_label,
            period_start=period.period_start, period_end=period.period_end, amount=period.amount,
        ))
    db.flush()

    record_audit_log(db, tenant.id, current_user.id, "create", "budget", budget.id,
                      f"Created budget '{budget.name}' ({data.scope_type}, FY{data.fiscal_year})")
    db.commit()
    db.refresh(budget)
    return _hydrate(db, tenant.id, budget)


@router.put("/{budget_id}", response_model=BudgetResponse)
def update_budget(
    budget_id: int, data: BudgetUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.tenant_id == tenant.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot edit an approved budget - reject or create a new one instead")

    old_total = round(sum(p.amount for p in budget.periods), 2)

    if data.name is not None:
        budget.name = data.name
    if data.notes is not None:
        budget.notes = data.notes
    if data.periods is not None:
        db.query(BudgetPeriod).filter(BudgetPeriod.budget_id == budget.id).delete()
        for period in data.periods:
            db.add(BudgetPeriod(
                budget_id=budget.id, tenant_id=tenant.id, period_label=period.period_label,
                period_start=period.period_start, period_end=period.period_end, amount=period.amount,
            ))

    db.flush()
    new_total = round(sum(p.amount for p in data.periods), 2) if data.periods is not None else old_total
    if new_total != old_total:
        record_audit_log(db, tenant.id, current_user.id, "revise", "budget", budget.id,
                          f"Revised '{budget.name}': {old_total} -> {new_total}", severity="warning")
    else:
        record_audit_log(db, tenant.id, current_user.id, "update", "budget", budget.id, f"Updated '{budget.name}'")

    db.commit()
    db.refresh(budget)
    return _hydrate(db, tenant.id, budget)


@router.put("/{budget_id}/submit", response_model=BudgetResponse)
def submit_budget(
    budget_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.tenant_id == tenant.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.status != "draft":
        raise HTTPException(status_code=400, detail=f"Cannot submit a budget in '{budget.status}' status")
    budget.status = "submitted"
    record_audit_log(db, tenant.id, current_user.id, "submit", "budget", budget.id, f"Submitted '{budget.name}' for approval")
    db.commit()
    db.refresh(budget)
    return _hydrate(db, tenant.id, budget)


@router.put("/{budget_id}/approve", response_model=BudgetResponse)
def approve_budget(
    budget_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.tenant_id == tenant.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.status != "submitted":
        raise HTTPException(status_code=400, detail="Only a submitted budget can be approved")
    from datetime import datetime
    budget.status = "approved"
    budget.approved_by = current_user.id
    budget.approved_at = datetime.utcnow()
    record_audit_log(db, tenant.id, current_user.id, "approve", "budget", budget.id, f"Approved '{budget.name}'")
    db.commit()
    db.refresh(budget)
    return _hydrate(db, tenant.id, budget)


@router.put("/{budget_id}/reject", response_model=BudgetResponse)
def reject_budget(
    budget_id: int, data: BudgetActionRequest,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.tenant_id == tenant.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.status != "submitted":
        raise HTTPException(status_code=400, detail="Only a submitted budget can be rejected")
    budget.status = "rejected"
    budget.rejected_reason = data.remarks
    record_audit_log(db, tenant.id, current_user.id, "reject", "budget", budget.id,
                      f"Rejected '{budget.name}'" + (f": {data.remarks}" if data.remarks else ""))
    db.commit()
    db.refresh(budget)
    return _hydrate(db, tenant.id, budget)


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.tenant_id == tenant.id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    if budget.status == "approved":
        raise HTTPException(status_code=400, detail="Cannot delete an approved budget")
    record_audit_log(db, tenant.id, current_user.id, "delete", "budget", budget_id, f"Deleted '{budget.name}'")
    db.delete(budget)
    db.commit()
    return {"message": "Budget deleted successfully"}


@router.get("/{budget_id}/variance", response_model=BudgetVarianceResponse)
def get_budget_variance(
    budget_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Actual vs budget per period, computed live from posted ledger/expense/invoice data."""
    budget = db.query(Budget).options(joinedload(Budget.periods)).filter(
        Budget.id == budget_id, Budget.tenant_id == tenant.id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    period_variances = []
    total_budgeted = 0.0
    total_actual = 0.0
    for period in budget.periods:
        actual = compute_actual(db, tenant.id, budget, period.period_start, period.period_end)
        variance = round(period.amount - actual, 2)
        total_budgeted += period.amount
        total_actual += actual
        period_variances.append(PeriodVariance(
            period_label=period.period_label, period_start=period.period_start, period_end=period.period_end,
            budgeted=period.amount, actual=actual, variance=variance,
            utilization_pct=round(actual / period.amount * 100, 1) if period.amount else None,
            status=variance_status(period.amount, actual),
        ))

    return BudgetVarianceResponse(
        budget_id=budget.id, name=budget.name, scope_type=budget.scope_type,
        scope_label=get_scope_label(db, tenant.id, budget.scope_type, budget.scope_id),
        total_budgeted=round(total_budgeted, 2), total_actual=round(total_actual, 2),
        total_variance=round(total_budgeted - total_actual, 2),
        utilization_pct=round(total_actual / total_budgeted * 100, 1) if total_budgeted else None,
        periods=period_variances,
    )


@router.get("/reports/dashboard")
def get_budget_dashboard(
    fiscal_year: Optional[int] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Utilization, over-budget list, remaining budget, and scope breakdown across all approved budgets."""
    query = db.query(Budget).options(joinedload(Budget.periods)).filter(
        Budget.tenant_id == tenant.id, Budget.status == "approved"
    )
    if fiscal_year:
        query = query.filter(Budget.fiscal_year == fiscal_year)
    budgets = query.all()

    total_budgeted = 0.0
    total_actual = 0.0
    over_budget = []
    by_scope: dict = {}
    summaries = []

    for budget in budgets:
        budgeted = round(sum(p.amount for p in budget.periods), 2)
        actual = sum(compute_actual(db, tenant.id, budget, p.period_start, p.period_end) for p in budget.periods)
        actual = round(actual, 2)
        total_budgeted += budgeted
        total_actual += actual

        by_scope.setdefault(budget.scope_type, {"budgeted": 0.0, "actual": 0.0})
        by_scope[budget.scope_type]["budgeted"] += budgeted
        by_scope[budget.scope_type]["actual"] += actual

        summary = {
            "budget_id": budget.id, "name": budget.name, "scope_type": budget.scope_type,
            "scope_label": get_scope_label(db, tenant.id, budget.scope_type, budget.scope_id),
            "budgeted": budgeted, "actual": actual, "remaining": round(budgeted - actual, 2),
            "utilization_pct": round(actual / budgeted * 100, 1) if budgeted else None,
        }
        summaries.append(summary)
        if budgeted > 0 and actual > budgeted:
            over_budget.append(summary)

    return {
        "fiscal_year": fiscal_year,
        "total_budgets": len(budgets),
        "total_budgeted": round(total_budgeted, 2),
        "total_actual": round(total_actual, 2),
        "total_remaining": round(total_budgeted - total_actual, 2),
        "utilization_pct": round(total_actual / total_budgeted * 100, 1) if total_budgeted else None,
        "over_budget_count": len(over_budget),
        "over_budget": over_budget,
        "by_scope": {k: {"budgeted": round(v["budgeted"], 2), "actual": round(v["actual"], 2)} for k, v in by_scope.items()},
        "budgets": summaries,
    }
