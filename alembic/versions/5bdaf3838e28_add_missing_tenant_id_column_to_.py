"""add missing tenant_id column to documents

Revision ID: 5bdaf3838e28
Revises: b0cc45a150d5
Create Date: 2026-06-30 12:23:29.735082

The Document model has declared tenant_id since it was first written, but the
column was never actually added to the live database - it was created via an
early manual create_all() pass before tenant_id was added to the model, and
schema drift was carried forward silently because there were no migrations.
Confirmed via inspection that the documents table currently has 0 rows, so
this can be added as NOT NULL directly with no backfill needed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5bdaf3838e28'
down_revision: Union[str, Sequence[str], None] = 'b0cc45a150d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('documents', sa.Column('tenant_id', sa.Integer(), nullable=False))
    op.create_foreign_key(
        'documents_tenant_id_fkey', 'documents', 'tenants', ['tenant_id'], ['id']
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('documents_tenant_id_fkey', 'documents', type_='foreignkey')
    op.drop_column('documents', 'tenant_id')
