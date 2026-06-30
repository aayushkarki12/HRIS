from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime, date


# ============ Expense Claim Line Schemas ============

class ExpenseClaimLineBase(BaseModel):
    description: str = Field(..., min_length=2, max_length=255)
    amount: float = Field(..., gt=0)
    category: str = Field(..., pattern="^(travel|meals|supplies|software|equipment|communication|other)$")
    receipt_url: Optional[str] = None


class ExpenseClaimLineCreate(ExpenseClaimLineBase):
    pass


class ExpenseClaimLineResponse(ExpenseClaimLineBase):
    id: int
    expense_claim_id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Expense Claim Schemas ============

class ExpenseClaimCreate(BaseModel):
    date: date
    description: str = Field(..., min_length=2, max_length=500)
    lines: List[ExpenseClaimLineCreate] = Field(..., min_length=1)


class ExpenseClaimUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=2, max_length=500)
    lines: Optional[List[ExpenseClaimLineCreate]] = None


class ExpenseClaimResponse(BaseModel):
    id: int
    claim_number: str
    employee_id: int
    date: date
    description: str
    total_amount: float
    status: str
    submitted_at: Optional[datetime] = None
    manager_approved_by: Optional[int] = None
    manager_approved_at: Optional[datetime] = None
    accounting_approved_by: Optional[int] = None
    accounting_approved_at: Optional[datetime] = None
    rejected_by: Optional[int] = None
    rejected_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    paid_at: Optional[datetime] = None
    journal_entry_id: Optional[int] = None
    tenant_id: int
    lines: List[ExpenseClaimLineResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
