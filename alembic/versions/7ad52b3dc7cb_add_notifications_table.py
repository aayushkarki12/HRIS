"""add notifications table

Revision ID: 7ad52b3dc7cb
Revises: 60caac406d2b
Create Date: 2026-06-30 17:51:53.224768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7ad52b3dc7cb'
down_revision: Union[str, Sequence[str], None] = '60caac406d2b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('notifications',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('tenant_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('entity_type', sa.String(length=50), nullable=True),
    sa.Column('entity_id', sa.Integer(), nullable=True),
    sa.Column('is_read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'], unique=False)
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_notifications_user_id'), table_name='notifications')
    op.drop_index('ix_notifications_user_created', table_name='notifications')
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_table('notifications')
