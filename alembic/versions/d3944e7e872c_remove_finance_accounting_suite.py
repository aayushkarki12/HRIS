"""remove finance/accounting suite

Revision ID: d3944e7e872c
Revises: 2a3ca5397ff8
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3944e7e872c'
down_revision: Union[str, Sequence[str], None] = '2a3ca5397ff8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Every permission key owned exclusively by the removed Finance/Accounting
# suite (Vouchers, Invoices, Expense Claims, Payroll, Budgets, and the
# accounting.py router itself). inventory.manage is NOT in this list - it
# stays, Inventory is kept.
REMOVED_PERMISSION_KEYS = [
    "journal_entry.manage",
    "accounting.manage",
    "reports.financial.view",
    "voucher.create",
    "voucher.post",
    "voucher.approve",
    "invoice.manage",
    "invoice.approve",
    "expense.approve_manager",
    "expense.approve_accounting",
    "payroll.manage",
    "payroll.view_all",
    "budget.approve",
]


def upgrade() -> None:
    """Upgrade schema.

    Drops the entire Finance/Accounting suite the user asked to remove in
    full: Accounting (chart of accounts, ledger groups, journal entries,
    cost centers, tax rates, bank reconciliation), Vouchers, Invoices,
    Expense Claims, Payroll, and Budgets. Inventory is kept but loses its
    optional ledger linkage (inventory_account_id/cogs_account_id on items,
    voucher_id on stock_movements) since the accounts/vouchers tables it
    optionally pointed to no longer exist.

    This migration is intentionally NOT reversible (see downgrade()) - it
    permanently deletes financial transaction history along with the
    schema. Take a database backup before running this against real data.
    """
    # Drop the optional ledger-linkage columns on tables we're keeping,
    # before dropping the tables their FKs point at.
    op.drop_column("items", "inventory_account_id")
    op.drop_column("items", "cogs_account_id")
    op.drop_column("stock_movements", "voucher_id")

    # Drop tables in FK-safe child-to-parent order.
    op.drop_table("payslip_lines")
    op.drop_table("budget_periods")
    op.drop_table("expense_claim_lines")
    op.drop_table("payments")
    op.drop_table("invoice_lines")
    op.drop_table("bank_reconciliations")
    op.drop_table("vouchers")
    op.drop_table("journal_entry_lines")
    op.drop_table("payslips")
    op.drop_table("payroll_runs")
    op.drop_table("expense_claims")
    op.drop_table("invoices")
    op.drop_table("budgets")
    op.drop_table("salary_structures")
    op.drop_table("journal_entries")
    op.drop_table("accounts")
    op.drop_table("cost_centers")
    op.drop_table("tax_rates")
    op.drop_table("ledger_groups")

    # Remove the now-dead permission keys. role_permissions/approval_limits
    # have plain (non-cascading) FKs to permissions.key, so their rows must
    # be deleted first.
    keys_sql = ", ".join(f"'{k}'" for k in REMOVED_PERMISSION_KEYS)
    op.execute(f"DELETE FROM role_permissions WHERE permission_key IN ({keys_sql})")
    op.execute(f"DELETE FROM approval_limits WHERE permission_key IN ({keys_sql})")
    op.execute(f"DELETE FROM permissions WHERE key IN ({keys_sql})")


def downgrade() -> None:
    """Downgrade schema.

    Not supported - this migration permanently deletes financial
    transaction data (journal entries, invoices, payroll runs, expense
    claims, budgets, vouchers) along with the tables that held it.
    Restore from a pre-upgrade backup instead of downgrading.
    """
    raise NotImplementedError(
        "This migration drops the Finance/Accounting suite's data "
        "destructively and cannot be downgraded automatically. Restore "
        "from a backup taken before upgrading to d3944e7e872c."
    )
