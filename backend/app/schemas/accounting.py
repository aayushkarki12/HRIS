from pydantic import BaseModel, Field, validator, model_validator
from typing import Optional, List
from datetime import datetime, date


class AccountBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    account_type: str = Field(..., pattern="^(asset|liability|equity|income|expense)$")
    parent_id: Optional[int] = None
    ledger_group_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    account_type: Optional[str] = Field(None, pattern="^(asset|liability|equity|income|expense)$")
    parent_id: Optional[int] = None
    ledger_group_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AccountTreeResponse(AccountResponse):
    children: List["AccountTreeResponse"] = []

    class Config:
        from_attributes = True


# ============ Ledger Group Schemas ============

LEDGER_GROUP_NATURE_PATTERN = "^(asset|liability|equity|income|expense)$"


class LedgerGroupBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    parent_id: Optional[int] = None
    nature: str = Field(..., pattern=LEDGER_GROUP_NATURE_PATTERN)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: int = 0
    is_active: bool = True


class LedgerGroupCreate(LedgerGroupBase):
    pass


class LedgerGroupUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    parent_id: Optional[int] = None
    nature: Optional[str] = Field(None, pattern=LEDGER_GROUP_NATURE_PATTERN)
    color: Optional[str] = Field(None, max_length=20)
    icon: Optional[str] = Field(None, max_length=50)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class LedgerGroupReorder(BaseModel):
    parent_id: Optional[int] = None
    sort_order: int = 0


class LedgerGroupResponse(LedgerGroupBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LedgerGroupTreeResponse(LedgerGroupResponse):
    children: List["LedgerGroupTreeResponse"] = []
    account_count: int = 0
    total_debit: float = 0
    total_credit: float = 0
    balance: float = 0

    class Config:
        from_attributes = True


# ============ Cost Center Schemas ============

class CostCenterBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    parent_id: Optional[int] = None
    budget_amount: Optional[float] = Field(None, ge=0)
    is_active: bool = True


class CostCenterCreate(CostCenterBase):
    pass


class CostCenterUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    parent_id: Optional[int] = None
    budget_amount: Optional[float] = Field(None, ge=0)
    is_active: Optional[bool] = None


class CostCenterResponse(CostCenterBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Tax Rate Schemas ============

class TaxRateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    tax_type: str = Field("GST", pattern="^(GST|CGST|SGST|IGST|VAT|other)$")
    rate: float = Field(..., ge=0, le=100)
    is_active: bool = True


class TaxRateCreate(TaxRateBase):
    pass


class TaxRateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    tax_type: Optional[str] = Field(None, pattern="^(GST|CGST|SGST|IGST|VAT|other)$")
    rate: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class TaxRateResponse(TaxRateBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Journal Entry Line Schemas ============

class JournalEntryLineBase(BaseModel):
    account_id: int
    description: Optional[str] = None
    debit: float = Field(0, ge=0)
    credit: float = Field(0, ge=0)
    cost_center_id: Optional[int] = None
    tax_rate_id: Optional[int] = None

    @validator('credit')
    def validate_debit_or_credit(cls, v, values):
        debit = values.get('debit', 0)
        if debit > 0 and v > 0:
            raise ValueError('A line cannot have both debit and credit')
        if debit == 0 and v == 0:
            raise ValueError('A line must have either debit or credit')
        return v


class JournalEntryLineCreate(JournalEntryLineBase):
    pass


class JournalEntryLineResponse(JournalEntryLineBase):
    id: int
    journal_entry_id: int
    tenant_id: int
    account: Optional[AccountResponse] = None
    cost_center: Optional[CostCenterResponse] = None
    tax_rate: Optional[TaxRateResponse] = None
    is_reconciled: bool = False
    reconciled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


VOUCHER_TYPE_PATTERN = "^(journal|payment|receipt|contra|sales|purchase|debit_note|credit_note)$"


# ============ Journal Entry Schemas ============

class JournalEntryBase(BaseModel):
    date: date
    description: str = Field(..., min_length=2, max_length=500)
    reference: Optional[str] = Field(None, max_length=100)
    reference_type: Optional[str] = Field(None, pattern="^(manual|payroll|expense|invoice)$")
    voucher_type: str = Field("journal", pattern=VOUCHER_TYPE_PATTERN)


class JournalEntryCreate(JournalEntryBase):
    lines: List[JournalEntryLineCreate] = Field(..., min_length=2)

    @model_validator(mode='after')
    def validate_double_entry(self):
        total_debit = sum(line.debit for line in self.lines)
        total_credit = sum(line.credit for line in self.lines)
        if round(total_debit, 2) != round(total_credit, 2):
            raise ValueError(
                f'Total debits ({total_debit:.2f}) must equal total credits ({total_credit:.2f})'
            )
        return self


class JournalEntryUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=2, max_length=500)
    reference: Optional[str] = Field(None, max_length=100)
    reference_type: Optional[str] = Field(None, pattern="^(manual|payroll|expense|invoice)$")
    voucher_type: Optional[str] = Field(None, pattern=VOUCHER_TYPE_PATTERN)
    lines: Optional[List[JournalEntryLineCreate]] = None

    @model_validator(mode='after')
    def validate_double_entry(self):
        if self.lines is not None:
            total_debit = sum(line.debit for line in self.lines)
            total_credit = sum(line.credit for line in self.lines)
            if round(total_debit, 2) != round(total_credit, 2):
                raise ValueError(
                    f'Total debits ({total_debit:.2f}) must equal total credits ({total_credit:.2f})'
                )
        return self


class JournalEntryResponse(JournalEntryBase):
    id: int
    entry_number: str
    status: str
    posted_by: Optional[int] = None
    posted_at: Optional[datetime] = None
    tenant_id: int
    lines: List[JournalEntryLineResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ General Ledger Schemas ============

class LedgerLineResponse(BaseModel):
    id: int
    date: date
    entry_number: str
    journal_entry_id: int
    description: Optional[str] = None
    entry_description: str
    reference: Optional[str] = None
    debit: float
    credit: float
    running_balance: float


class LedgerAccountResponse(BaseModel):
    account_id: int
    account_code: str
    account_name: str
    account_type: str
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    lines: List[LedgerLineResponse] = []


# ============ Bank Reconciliation Schemas ============

class UnreconciledLineResponse(BaseModel):
    id: int
    date: date
    entry_number: str
    voucher_type: str
    description: Optional[str] = None
    reference: Optional[str] = None
    debit: float
    credit: float

    class Config:
        from_attributes = True


class ReconciliationStatusResponse(BaseModel):
    account_id: int
    account_code: str
    account_name: str
    book_balance: float
    reconciled_balance: float
    unreconciled_lines: List[UnreconciledLineResponse] = []


class ReconcileRequest(BaseModel):
    line_ids: List[int] = Field(..., min_length=1)
    statement_date: date
    statement_balance: float
    notes: Optional[str] = Field(None, max_length=500)


class BankReconciliationResponse(BaseModel):
    id: int
    account_id: int
    statement_date: date
    statement_balance: float
    book_balance: float
    difference: float
    notes: Optional[str] = None
    reconciled_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
