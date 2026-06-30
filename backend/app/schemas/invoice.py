from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, date


# ============ Invoice Line Schemas ============

class InvoiceLineBase(BaseModel):
    description: str = Field(..., min_length=2, max_length=255)
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)


class InvoiceLineCreate(InvoiceLineBase):
    pass


class InvoiceLineResponse(InvoiceLineBase):
    id: int
    invoice_id: int
    amount: float
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Payment Schemas ============

class PaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_date: date
    payment_method: str = Field(..., pattern="^(bank_transfer|cash|check|online)$")
    reference: Optional[str] = Field(None, max_length=100)


class PaymentResponse(BaseModel):
    id: int
    invoice_id: int
    amount: float
    payment_date: date
    payment_method: str
    reference: Optional[str] = None
    journal_entry_id: Optional[int] = None
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Invoice Schemas ============

class InvoiceCreate(BaseModel):
    customer_name: str = Field(..., min_length=2, max_length=100)
    customer_email: Optional[str] = None
    project_id: Optional[int] = None
    issue_date: date
    due_date: date
    tax_rate: float = Field(0, ge=0, le=100)
    lines: List[InvoiceLineCreate] = Field(..., min_length=1)


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=2, max_length=100)
    customer_email: Optional[str] = None
    project_id: Optional[int] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    tax_rate: Optional[float] = Field(None, ge=0, le=100)
    lines: Optional[List[InvoiceLineCreate]] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    customer_name: str
    customer_email: Optional[str] = None
    project_id: Optional[int] = None
    issue_date: date
    due_date: date
    subtotal: float
    tax_rate: float
    tax_amount: float
    total_amount: float
    amount_paid: float
    status: str
    journal_entry_id: Optional[int] = None
    tenant_id: int
    lines: List[InvoiceLineResponse] = []
    payments: List[PaymentResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
