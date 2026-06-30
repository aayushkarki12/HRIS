from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# ============ Salary Structure Schemas ============

class SalaryStructureBase(BaseModel):
    employee_id: int
    base_salary: float = Field(..., gt=0)
    currency: str = Field("USD", max_length=10)
    effective_date: date
    is_active: bool = True


class SalaryStructureCreate(SalaryStructureBase):
    pass


class SalaryStructureUpdate(BaseModel):
    base_salary: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = Field(None, max_length=10)
    effective_date: Optional[date] = None
    is_active: Optional[bool] = None


class SalaryStructureResponse(SalaryStructureBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Payslip Line Schemas ============

class PayslipLineResponse(BaseModel):
    id: int
    payslip_id: int
    line_type: str
    description: str
    amount: float
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Payslip Schemas ============

class PayslipResponse(BaseModel):
    id: int
    payroll_run_id: int
    employee_id: int
    base_salary: float
    gross_salary: float
    total_deductions: float
    net_salary: float
    working_days: float
    leave_days: float
    overtime_hours: float
    tenant_id: int
    lines: List[PayslipLineResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Payroll Run Schemas ============

class PayrollRunCreate(BaseModel):
    period_start: date
    period_end: date


class PayrollRunResponse(BaseModel):
    id: int
    period_start: date
    period_end: date
    status: str
    processed_by: Optional[int] = None
    processed_at: Optional[datetime] = None
    total_gross: float
    total_deductions: float
    total_net: float
    journal_entry_id: Optional[int] = None
    tenant_id: int
    payslips: List[PayslipResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
