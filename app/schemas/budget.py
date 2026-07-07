from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import date, datetime

PERIOD_TYPE_PATTERN = "^(annual|quarterly|monthly)$"
SCOPE_TYPE_PATTERN = "^(company|cost_center|project|employee)$"
BUDGET_STATUS_PATTERN = "^(draft|submitted|approved|rejected)$"


class BudgetPeriodInput(BaseModel):
    period_label: str = Field(..., min_length=1, max_length=20)
    period_start: date
    period_end: date
    amount: float = Field(..., ge=0)


class BudgetPeriodResponse(BudgetPeriodInput):
    id: int
    budget_id: int

    class Config:
        from_attributes = True


class BudgetCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    fiscal_year: int = Field(..., ge=2000, le=2100)
    period_type: str = Field(..., pattern=PERIOD_TYPE_PATTERN)
    scope_type: str = Field(..., pattern=SCOPE_TYPE_PATTERN)
    scope_id: Optional[int] = None
    account_id: Optional[int] = None
    notes: Optional[str] = None
    periods: List[BudgetPeriodInput] = Field(..., min_length=1)

    @model_validator(mode="after")
    def scope_id_required_unless_company(self):
        if self.scope_type != "company" and not self.scope_id:
            raise ValueError(f"scope_id is required for scope_type '{self.scope_type}'")
        return self


class BudgetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    notes: Optional[str] = None
    periods: Optional[List[BudgetPeriodInput]] = Field(None, min_length=1)


class BudgetActionRequest(BaseModel):
    remarks: Optional[str] = None


class BudgetResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    fiscal_year: int
    period_type: str
    scope_type: str
    scope_id: Optional[int] = None
    account_id: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_by: Optional[int] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejected_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    periods: List[BudgetPeriodResponse] = []
    total_budgeted: float = 0
    scope_label: Optional[str] = None

    class Config:
        from_attributes = True


class PeriodVariance(BaseModel):
    period_label: str
    period_start: date
    period_end: date
    budgeted: float
    actual: float
    variance: float
    utilization_pct: Optional[float] = None
    status: str  # under | on_track | over


class BudgetVarianceResponse(BaseModel):
    budget_id: int
    name: str
    scope_type: str
    scope_label: Optional[str] = None
    total_budgeted: float
    total_actual: float
    total_variance: float
    utilization_pct: Optional[float] = None
    periods: List[PeriodVariance]
