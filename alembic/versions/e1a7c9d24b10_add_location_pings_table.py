"""add location_pings table

Revision ID: e1a7c9d24b10
Revises: bcecc5c2f366
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a7c9d24b10'
down_revision: Union[str, Sequence[str], None] = 'bcecc5c2f366'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Periodic whereabouts stream from the mobile app.

    Append-only and higher volume than attendance, hence its own table:
    attendance stays one authoritative row per employee per day, and this
    can be pruned on whatever retention the tenant wants without touching
    it. recorded_at (device clock at GPS fix) is indexed rather than
    received_at because offline batches arrive out of order.
    """
    op.create_table(
        "location_pings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accuracy", sa.Float(), nullable=True),
        sa.Column("battery_level", sa.Integer(), nullable=True),
        sa.Column("location_status", sa.String(length=20), nullable=True, server_default="unknown"),
        sa.Column("location_name", sa.String(length=100), nullable=True),
        sa.Column("was_queued", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["employee_id"], ["employees.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_location_pings_id", "location_pings", ["id"])
    op.create_index("ix_location_pings_employee_recorded", "location_pings", ["employee_id", "recorded_at"])
    op.create_index("ix_location_pings_tenant_recorded", "location_pings", ["tenant_id", "recorded_at"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_location_pings_tenant_recorded", table_name="location_pings")
    op.drop_index("ix_location_pings_employee_recorded", table_name="location_pings")
    op.drop_index("ix_location_pings_id", table_name="location_pings")
    op.drop_table("location_pings")
