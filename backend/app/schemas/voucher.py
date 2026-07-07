from pydantic import BaseModel, Field, model_validator
from typing import List, Optional
from datetime import datetime, date

from .accounting import JournalEntryLineCreate, JournalEntryResponse

VOUCHER_TYPE_PATTERN = "^(payment|receipt|contra|journal|sales|purchase|credit_note|debit_note)$"
VOUCHER_STATUS_PATTERN = "^(draft|submitted|approved|rejected|cancelled|posted)$"

VOUCHER_PREFIXES = {
    "payment": "PV", "receipt": "RV", "contra": "CV", "journal": "JV",
    "sales": "SV", "purchase": "PUR", "credit_note": "CN", "debit_note": "DN",
}

VOUCHER_LABELS = {
    "payment": "Payment Voucher", "receipt": "Receipt Voucher", "contra": "Contra Voucher",
    "journal": "Journal Voucher", "sales": "Sales Voucher", "purchase": "Purchase Voucher",
    "credit_note": "Credit Note", "debit_note": "Debit Note",
}


class VoucherCreate(BaseModel):
    voucher_type: str = Field(..., pattern=VOUCHER_TYPE_PATTERN)
    voucher_date: date
    currency: str = Field("USD", max_length=10)
    party_type: Optional[str] = Field(None, pattern="^(employee|customer|vendor|other)$")
    party_name: Optional[str] = Field(None, max_length=150)
    payment_method: Optional[str] = Field(None, pattern="^(cash|bank|cheque|online)$")
    bank_account_id: Optional[int] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    due_date: Optional[date] = None
    remarks: Optional[str] = None
    description: str = Field(..., min_length=2, max_length=500)
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


class VoucherActionRequest(BaseModel):
    remarks: Optional[str] = Field(None, max_length=500)


class SimpleUserInfo(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: str

    class Config:
        from_attributes = True


class VoucherResponse(BaseModel):
    id: int
    tenant_id: int
    journal_entry_id: int
    voucher_type: str
    voucher_number: str
    voucher_date: date
    currency: str
    status: str
    party_type: Optional[str] = None
    party_name: Optional[str] = None
    payment_method: Optional[str] = None
    bank_account_id: Optional[int] = None
    reference_number: Optional[str] = None
    due_date: Optional[date] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None
    remarks: Optional[str] = None
    rejected_reason: Optional[str] = None
    attachment_url: Optional[str] = None
    prepared_by: Optional[int] = None
    submitted_by: Optional[int] = None
    submitted_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    posted_by: Optional[int] = None
    posted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    journal_entry: Optional[JournalEntryResponse] = None
    preparer: Optional[SimpleUserInfo] = None
    approver: Optional[SimpleUserInfo] = None
    poster: Optional[SimpleUserInfo] = None

    # Computed convenience fields
    voucher_label: Optional[str] = None
    accounting_period: Optional[str] = None
    total_debit: Optional[float] = None
    total_credit: Optional[float] = None

    class Config:
        from_attributes = True
