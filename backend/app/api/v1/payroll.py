import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, date

from ...core.database import get_db
from ...core.dependencies import (
    get_current_active_user, get_current_admin_user,
    get_current_tenant, get_current_employee
)
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.payroll import SalaryStructure, PayrollRun, Payslip, PayslipLine
from ...models.attendance import Attendance
from ...models.leave import Leave
from ...models.accounting import Account, JournalEntry, JournalEntryLine
from ...schemas.payroll import (
    SalaryStructureCreate, SalaryStructureUpdate, SalaryStructureResponse,
    PayrollRunCreate, PayrollRunResponse, PayslipResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payroll", tags=["payroll"])

# ============================================
# SALARY STRUCTURES
# ============================================

@router.get("/salary-structures", response_model=List[SalaryStructureResponse])
def get_salary_structures(
    employee_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get salary structures. Admin sees all, regular users see only their own."""
    try:
        query = db.query(SalaryStructure).filter(SalaryStructure.tenant_id == tenant.id)

        if current_user.role not in ["admin", "manager"]:
            employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if not employee:
                return []
            query = query.filter(SalaryStructure.employee_id == employee.id)
        elif employee_id:
            query = query.filter(SalaryStructure.employee_id == employee_id)

        return query.order_by(SalaryStructure.effective_date.desc()).all()
    except Exception as e:
        logger.error(f"Error in get_salary_structures: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/salary-structures", response_model=SalaryStructureResponse, status_code=status.HTTP_201_CREATED)
def create_salary_structure(
    data: SalaryStructureCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a salary structure for an employee (admin only)."""
    try:
        employee = db.query(Employee).filter(
            Employee.id == data.employee_id,
            Employee.tenant_id == tenant.id
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")

        existing = db.query(SalaryStructure).filter(
            SalaryStructure.employee_id == data.employee_id,
            SalaryStructure.tenant_id == tenant.id,
            SalaryStructure.is_active == True
        ).first()
        if existing:
            existing.is_active = False

        db_salary = SalaryStructure(**data.model_dump(), tenant_id=tenant.id)
        db.add(db_salary)
        db.flush()

        record_audit_log(db, tenant.id, current_user.id, "create", "salary_structure", db_salary.id,
                          f"Set salary for employee {employee.id} to {data.base_salary} {data.currency}")

        db.commit()
        db.refresh(db_salary)
        return db_salary
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_salary_structure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/salary-structures/{structure_id}", response_model=SalaryStructureResponse)
def update_salary_structure(
    structure_id: int,
    data: SalaryStructureUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a salary structure (admin only)."""
    try:
        structure = db.query(SalaryStructure).filter(
            SalaryStructure.id == structure_id,
            SalaryStructure.tenant_id == tenant.id
        ).first()
        if not structure:
            raise HTTPException(status_code=404, detail="Salary structure not found")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(structure, key, value)

        db.commit()
        db.refresh(structure)
        return structure
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_salary_structure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PAYROLL RUNS
# ============================================

@router.get("/runs", response_model=List[PayrollRunResponse])
def get_payroll_runs(
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get all payroll runs (admin only)."""
    try:
        runs = db.query(PayrollRun).options(
            joinedload(PayrollRun.payslips).joinedload(Payslip.lines)
        ).filter(
            PayrollRun.tenant_id == tenant.id
        ).order_by(PayrollRun.period_start.desc()).all()
        return runs
    except Exception as e:
        logger.error(f"Error in get_payroll_runs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/runs", response_model=PayrollRunResponse, status_code=status.HTTP_201_CREATED)
def create_payroll_run(
    data: PayrollRunCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create a payroll run and generate payslips for all active employees.
    Pulls data from Attendance and Leave for the period.
    """
    try:
        if data.period_end < data.period_start:
            raise HTTPException(status_code=400, detail="End date must be after start date")

        existing = db.query(PayrollRun).filter(
            PayrollRun.tenant_id == tenant.id,
            PayrollRun.period_start == data.period_start,
            PayrollRun.period_end == data.period_end
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A payroll run already exists for this period")

        employees = db.query(Employee).filter(
            Employee.tenant_id == tenant.id,
            Employee.is_active == True
        ).all()

        if not employees:
            raise HTTPException(status_code=400, detail="No active employees found")

        total_days_in_period = (data.period_end - data.period_start).days + 1
        working_days_in_period = sum(
            1 for d in range(total_days_in_period)
            if (data.period_start.toordinal() + d) % 7 not in (5, 6)
        )

        db_run = PayrollRun(
            period_start=data.period_start,
            period_end=data.period_end,
            status="draft",
            tenant_id=tenant.id,
        )
        db.add(db_run)
        db.flush()

        employee_ids = [e.id for e in employees]

        # Batch-fetch everything up front instead of querying per-employee
        # inside the loop below (was O(n) queries for n employees - now O(1)).
        salary_rows = db.query(SalaryStructure).filter(
            SalaryStructure.employee_id.in_(employee_ids),
            SalaryStructure.tenant_id == tenant.id,
            SalaryStructure.is_active == True
        ).all()
        salary_by_employee = {s.employee_id: s for s in salary_rows}

        leave_rows = db.query(Leave).filter(
            Leave.employee_id.in_(employee_ids),
            Leave.tenant_id == tenant.id,
            Leave.status == "approved",
            Leave.start_date <= data.period_end,
            Leave.end_date >= data.period_start,
        ).all()
        leaves_by_employee: dict[int, list] = {}
        for leave in leave_rows:
            leaves_by_employee.setdefault(leave.employee_id, []).append(leave)

        attendance_rows = db.query(
            Attendance.employee_id, func.count(Attendance.id)
        ).filter(
            Attendance.employee_id.in_(employee_ids),
            Attendance.tenant_id == tenant.id,
            Attendance.date >= data.period_start,
            Attendance.date <= data.period_end,
            Attendance.status == "present",
        ).group_by(Attendance.employee_id).all()
        attendance_by_employee = {emp_id: count for emp_id, count in attendance_rows}

        run_total_gross = 0.0
        run_total_deductions = 0.0
        run_total_net = 0.0

        for employee in employees:
            salary = salary_by_employee.get(employee.id)

            base_salary = salary.base_salary if salary else 0.0
            if base_salary == 0:
                continue

            leave_days = 0.0
            for leave in leaves_by_employee.get(employee.id, []):
                leave_start = max(leave.start_date, data.period_start)
                leave_end = min(leave.end_date, data.period_end)
                leave_days += (leave_end - leave_start).days + 1

            attendance_days = attendance_by_employee.get(employee.id, 0)

            actual_working_days = max(attendance_days, working_days_in_period - leave_days)

            daily_rate = base_salary / working_days_in_period if working_days_in_period > 0 else 0
            gross_salary = daily_rate * actual_working_days

            tax_rate = 0.10
            tax_deduction = round(gross_salary * tax_rate, 2)
            insurance_deduction = round(base_salary * 0.02, 2)
            total_deductions = tax_deduction + insurance_deduction
            net_salary = round(gross_salary - total_deductions, 2)
            gross_salary = round(gross_salary, 2)

            db_payslip = Payslip(
                payroll_run_id=db_run.id,
                employee_id=employee.id,
                base_salary=base_salary,
                gross_salary=gross_salary,
                total_deductions=total_deductions,
                net_salary=net_salary,
                working_days=actual_working_days,
                leave_days=leave_days,
                overtime_hours=0,
                tenant_id=tenant.id,
            )
            db.add(db_payslip)
            db.flush()

            payslip_lines = [
                PayslipLine(payslip_id=db_payslip.id, line_type="earning",
                            description="Base Salary", amount=gross_salary, tenant_id=tenant.id),
                PayslipLine(payslip_id=db_payslip.id, line_type="deduction",
                            description="Income Tax (10%)", amount=tax_deduction, tenant_id=tenant.id),
                PayslipLine(payslip_id=db_payslip.id, line_type="deduction",
                            description="Insurance (2%)", amount=insurance_deduction, tenant_id=tenant.id),
            ]
            db.add_all(payslip_lines)

            run_total_gross += gross_salary
            run_total_deductions += total_deductions
            run_total_net += net_salary

        db_run.total_gross = round(run_total_gross, 2)
        db_run.total_deductions = round(run_total_deductions, 2)
        db_run.total_net = round(run_total_net, 2)

        db.commit()

        result = db.query(PayrollRun).options(
            joinedload(PayrollRun.payslips).joinedload(Payslip.lines)
        ).filter(PayrollRun.id == db_run.id).first()
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_payroll_run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/runs/{run_id}", response_model=PayrollRunResponse)
def get_payroll_run(
    run_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get a payroll run by ID with payslips."""
    try:
        run = db.query(PayrollRun).options(
            joinedload(PayrollRun.payslips).joinedload(Payslip.lines)
        ).filter(
            PayrollRun.id == run_id,
            PayrollRun.tenant_id == tenant.id
        ).first()
        if not run:
            raise HTTPException(status_code=404, detail="Payroll run not found")
        return run
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_payroll_run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/runs/{run_id}/process", response_model=PayrollRunResponse)
def process_payroll_run(
    run_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Process a payroll run: mark as processed and create a journal entry.
    Requires a 'Salary Expense' account (code 5000) and a 'Cash' or 'Bank' account.
    """
    try:
        run = db.query(PayrollRun).options(
            joinedload(PayrollRun.payslips).joinedload(Payslip.lines)
        ).filter(
            PayrollRun.id == run_id,
            PayrollRun.tenant_id == tenant.id
        ).first()

        if not run:
            raise HTTPException(status_code=404, detail="Payroll run not found")
        if run.status == "processed":
            raise HTTPException(status_code=400, detail="Payroll run is already processed")
        if run.status == "paid":
            raise HTTPException(status_code=400, detail="Payroll run is already paid")
        if not run.payslips:
            raise HTTPException(status_code=400, detail="No payslips in this payroll run")

        salary_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code == "5000",
            Account.is_active == True
        ).first()

        cash_account = db.query(Account).filter(
            Account.tenant_id == tenant.id,
            Account.code.in_(["1000", "1100"]),
            Account.is_active == True
        ).first()

        if not salary_account or not cash_account:
            raise HTTPException(
                status_code=400,
                detail="Accounting accounts not set up. Need account codes 5000 (Salary Expense) and 1000 or 1100 (Cash/Bank)."
            )

        entry_count = db.query(JournalEntry).filter(
            JournalEntry.tenant_id == tenant.id
        ).count()
        entry_number = f"JE-{entry_count + 1:04d}"

        db_entry = JournalEntry(
            entry_number=entry_number,
            date=run.period_end,
            description=f"Payroll for {run.period_start} to {run.period_end}",
            reference=f"PAYROLL-{run.id}",
            reference_type="payroll",
            status="posted",
            posted_by=current_user.id,
            posted_at=datetime.now(),
            tenant_id=tenant.id,
        )
        db.add(db_entry)
        db.flush()

        db.add(JournalEntryLine(
            journal_entry_id=db_entry.id,
            account_id=salary_account.id,
            description=f"Salary expense for period",
            debit=run.total_gross,
            credit=0,
            tenant_id=tenant.id,
        ))
        db.add(JournalEntryLine(
            journal_entry_id=db_entry.id,
            account_id=cash_account.id,
            description=f"Salary payment",
            debit=0,
            credit=run.total_net,
            tenant_id=tenant.id,
        ))

        if run.total_deductions > 0:
            liability_account = db.query(Account).filter(
                Account.tenant_id == tenant.id,
                Account.code == "2000",
                Account.is_active == True
            ).first()
            if liability_account:
                db.add(JournalEntryLine(
                    journal_entry_id=db_entry.id,
                    account_id=liability_account.id,
                    description=f"Payroll deductions payable",
                    debit=0,
                    credit=run.total_deductions,
                    tenant_id=tenant.id,
                ))

        run.status = "processed"
        run.processed_by = current_user.id
        run.processed_at = datetime.now()
        run.journal_entry_id = db_entry.id

        record_audit_log(db, tenant.id, current_user.id, "process", "payroll_run", run.id,
                          f"Processed payroll for {run.period_start} to {run.period_end} "
                          f"({len(run.payslips)} payslips, net {run.total_net:.2f})")

        db.commit()

        result = db.query(PayrollRun).options(
            joinedload(PayrollRun.payslips).joinedload(Payslip.lines)
        ).filter(PayrollRun.id == run.id).first()
        return result
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in process_payroll_run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/runs/{run_id}")
def delete_payroll_run(
    run_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Delete a draft payroll run (admin only)."""
    try:
        run = db.query(PayrollRun).filter(
            PayrollRun.id == run_id,
            PayrollRun.tenant_id == tenant.id
        ).first()
        if not run:
            raise HTTPException(status_code=404, detail="Payroll run not found")
        if run.status != "draft":
            raise HTTPException(status_code=400, detail="Can only delete draft payroll runs")

        for payslip in db.query(Payslip).filter(Payslip.payroll_run_id == run.id).all():
            db.query(PayslipLine).filter(PayslipLine.payslip_id == payslip.id).delete()
        db.query(Payslip).filter(Payslip.payroll_run_id == run.id).delete()
        db.delete(run)
        db.commit()
        return {"message": "Payroll run deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_payroll_run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PAYSLIPS - EMPLOYEE SELF-SERVICE
# ============================================

@router.get("/my-payslips", response_model=List[PayslipResponse])
def get_my_payslips(
    current_employee: Employee = Depends(get_current_employee),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Get current employee's payslips."""
    try:
        payslips = db.query(Payslip).options(
            joinedload(Payslip.lines)
        ).filter(
            Payslip.employee_id == current_employee.id,
            Payslip.tenant_id == tenant.id
        ).order_by(Payslip.created_at.desc()).all()
        return payslips
    except Exception as e:
        logger.error(f"Error in get_my_payslips: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
