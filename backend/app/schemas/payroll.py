from pydantic import BaseModel, Field, computed_field
from typing import Optional, List
from datetime import datetime, date


# ============ Salary Structure Schemas ============

# Default SSF (Nepal Social Security Fund) employee-contribution percentage
# pre-filled in the admin UI when setting up a salary. This is a PLACEHOLDER
# for the admin to verify/adjust, not a value this codebase asserts is the
# current correct statutory rate - see CLAUDE.md and the SalaryStructure
# model's ssf_percent column comment for why it's not hardcoded as fact.
DEFAULT_SSF_PERCENT = 10.0


class SalaryStructureBase(BaseModel):
    employee_id: int
    base_salary: float = Field(..., gt=0)
    bonus: float = Field(0, ge=0)
    ssf_percent: float = Field(DEFAULT_SSF_PERCENT, ge=0, le=100,
                                description="Admin-editable SSF contribution % of base salary. "
                                            "Default is a placeholder - verify against current SSF rules.")
    other_deductions: float = Field(0, ge=0, description="Any other flat deduction (loan, advance, etc.)")
    currency: str = Field("USD", max_length=10)
    effective_date: date
    is_active: bool = True


class SalaryStructureCreate(SalaryStructureBase):
    pass


class SalaryStructureUpdate(BaseModel):
    base_salary: Optional[float] = Field(None, gt=0)
    bonus: Optional[float] = Field(None, ge=0)
    ssf_percent: Optional[float] = Field(None, ge=0, le=100)
    other_deductions: Optional[float] = Field(None, ge=0)
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

    @computed_field
    @property
    def ssf_amount(self) -> float:
        """SSF deduction in currency, derived from base_salary * ssf_percent."""
        return round(self.base_salary * (self.ssf_percent / 100.0), 2)

    @computed_field
    @property
    def total_deductions(self) -> float:
        return round(self.ssf_amount + self.other_deductions, 2)

    @computed_field
    @property
    def net_pay(self) -> float:
        """"Total in hand": base + bonus - all deductions."""
        return round(self.base_salary + self.bonus - self.total_deductions, 2)


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
