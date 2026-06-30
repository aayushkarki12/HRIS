"""add composite indexes for hot query paths

Revision ID: 9b674bc42feb
Revises: 4fb657f308e2
Create Date: 2026-06-30 12:47:48.593412

Every list endpoint filters by tenant_id plus usually a date range or
status. These composite indexes match those actual query patterns.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b674bc42feb'
down_revision: Union[str, Sequence[str], None] = '4fb657f308e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index('ix_attendances_tenant_date', 'attendances', ['tenant_id', 'date'], unique=False)
    op.create_index('ix_journal_entries_tenant_date', 'journal_entries', ['tenant_id', 'date'], unique=False)
    op.create_index('ix_journal_entries_tenant_status', 'journal_entries', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_leaves_tenant_status', 'leaves', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_expense_claims_tenant_status', 'expense_claims', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_invoices_tenant_status', 'invoices', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_timesheets_tenant_week_start', 'timesheets', ['tenant_id', 'week_start_date'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_timesheets_tenant_week_start', table_name='timesheets')
    op.drop_index('ix_invoices_tenant_status', table_name='invoices')
    op.drop_index('ix_expense_claims_tenant_status', table_name='expense_claims')
    op.drop_index('ix_leaves_tenant_status', table_name='leaves')
    op.drop_index('ix_journal_entries_tenant_status', table_name='journal_entries')
    op.drop_index('ix_journal_entries_tenant_date', table_name='journal_entries')
    op.drop_index('ix_attendances_tenant_date', table_name='attendances')
