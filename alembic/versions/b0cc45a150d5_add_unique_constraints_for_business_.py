"""add unique constraints for business document numbers

Revision ID: b0cc45a150d5
Revises: 4d5fbed54361
Create Date: 2026-06-30 12:14:04.140278

Adds (tenant_id, <business_key>) unique constraints so duplicate account
codes / entry numbers / invoice numbers / claim numbers are rejected at the
database level, closing a race condition where the application-level
"query then insert" uniqueness check could be beaten by a concurrent request.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0cc45a150d5'
down_revision: Union[str, Sequence[str], None] = '4d5fbed54361'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint('uq_accounts_tenant_code', 'accounts', ['tenant_id', 'code'])
    op.create_unique_constraint('uq_expense_claims_tenant_claim_number', 'expense_claims', ['tenant_id', 'claim_number'])
    op.create_unique_constraint('uq_invoices_tenant_invoice_number', 'invoices', ['tenant_id', 'invoice_number'])
    op.create_unique_constraint('uq_journal_entries_tenant_entry_number', 'journal_entries', ['tenant_id', 'entry_number'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_journal_entries_tenant_entry_number', 'journal_entries', type_='unique')
    op.drop_constraint('uq_invoices_tenant_invoice_number', 'invoices', type_='unique')
    op.drop_constraint('uq_expense_claims_tenant_claim_number', 'expense_claims', type_='unique')
    op.drop_constraint('uq_accounts_tenant_code', 'accounts', type_='unique')
