"""add employment type and salary structure fields

Revision ID: 2a3ca5397ff8
Revises: 6640c125a7dc
Create Date: 2026-07-28 12:59:41.034757

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a3ca5397ff8'
down_revision: Union[str, Sequence[str], None] = '6640c125a7dc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    - employees.employment_type: "full_time" | "probation" - drives a reduced
      leave allocation for probationers (see app/api/v1/leave.py).
    - salary_structures.bonus / ssf_percent / other_deductions: admin-editable
      compensation fields. ssf_percent defaults to 10.0 as a clearly-labeled
      PLACEHOLDER, not a verified Nepal SSF statutory rate - see the column
      comment and CLAUDE.md for why this is deliberately not hardcoded as fact.
    """
    op.add_column(
        "employees",
        sa.Column("employment_type", sa.String(length=20), nullable=False, server_default="full_time"),
    )
    op.add_column(
        "salary_structures",
        sa.Column("bonus", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "salary_structures",
        sa.Column("ssf_percent", sa.Float(), nullable=False, server_default="10.0"),
    )
    op.add_column(
        "salary_structures",
        sa.Column("other_deductions", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("salary_structures", "other_deductions")
    op.drop_column("salary_structures", "ssf_percent")
    op.drop_column("salary_structures", "bonus")
    op.drop_column("employees", "employment_type")
