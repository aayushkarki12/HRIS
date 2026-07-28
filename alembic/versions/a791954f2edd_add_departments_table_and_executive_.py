"""add departments table and executive seniority level

Revision ID: a791954f2edd
Revises: 5d53a0da51f4
Create Date: 2026-07-28 09:45:41.824015

Adds an admin-manageable Department picklist (Employee.department stays a
plain string - see app/models/department.py for why) and seeds default
departments covering both business lines plus corporate functions, and an
"Executive" seniority level above Lead. Admin can add more of either freely
via the Roles & Permissions page.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a791954f2edd'
down_revision: Union[str, Sequence[str], None] = '5d53a0da51f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_DEPARTMENTS = [
    "Development", "Quality Assurance", "Editing", "Human Resources", "Accounts", "Administration",
]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "departments" not in inspector.get_table_names():
        op.create_table(
            "departments",
            sa.Column("id", sa.Integer(), primary_key=True, index=True),
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("name", sa.String(length=80), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
        )

    departments_t = sa.table(
        "departments",
        sa.column("id", sa.Integer), sa.column("tenant_id", sa.Integer), sa.column("name", sa.String),
    )
    seniority_t = sa.table(
        "seniority_levels",
        sa.column("id", sa.Integer), sa.column("tenant_id", sa.Integer),
        sa.column("name", sa.String), sa.column("rank", sa.Integer),
    )

    tenant_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM tenants")).fetchall()]

    for tenant_id in tenant_ids:
        existing_depts = {
            row[0] for row in bind.execute(
                sa.text("SELECT name FROM departments WHERE tenant_id = :tid"), {"tid": tenant_id}
            ).fetchall()
        }
        for name in DEFAULT_DEPARTMENTS:
            if name not in existing_depts:
                bind.execute(departments_t.insert(), {"tenant_id": tenant_id, "name": name})

        has_executive = bind.execute(
            sa.text("SELECT 1 FROM seniority_levels WHERE tenant_id = :tid AND name = 'Executive'"), {"tid": tenant_id}
        ).first()
        if not has_executive:
            bind.execute(seniority_t.insert(), {"tenant_id": tenant_id, "name": "Executive", "rank": 5})


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM seniority_levels WHERE name = 'Executive'"))
    bind.execute(sa.text("DELETE FROM departments WHERE name = ANY(:names)"), {"names": DEFAULT_DEPARTMENTS})
    op.drop_table("departments")
