"""add employee attendance_type and fixed schedule fields

Revision ID: 6ad47c417fcb
Revises: d3944e7e872c
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ad47c417fcb'
down_revision: Union[str, Sequence[str], None] = 'd3944e7e872c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    - employees.attendance_type: "fixed" | "individual" | "contractor" -
      drives clock-in/out rules per employee (see app/api/v1/attendance.py).
      Deliberately separate from employment_type, which already drives the
      probation leave-allocation ratio.
    - employees.assigned_work_location_id: which WorkLocation a "fixed"
      employee is expected to clock in at (nullable, only meaningful for
      that type).
    - employees.fixed_clock_in_time / fixed_clock_out_time: "HH:MM" strings,
      only meaningful when attendance_type == "fixed".
    """
    op.add_column(
        "employees",
        sa.Column("attendance_type", sa.String(length=20), nullable=False, server_default="individual"),
    )
    op.add_column(
        "employees",
        sa.Column("assigned_work_location_id", sa.Integer(), sa.ForeignKey("work_locations.id"), nullable=True),
    )
    op.add_column(
        "employees",
        sa.Column("fixed_clock_in_time", sa.String(length=5), nullable=True),
    )
    op.add_column(
        "employees",
        sa.Column("fixed_clock_out_time", sa.String(length=5), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("employees", "fixed_clock_out_time")
    op.drop_column("employees", "fixed_clock_in_time")
    op.drop_column("employees", "assigned_work_location_id")
    op.drop_column("employees", "attendance_type")
