"""add project resource assignment accounting permission keys

Revision ID: bb8040b99176
Revises: 7a1546165120
Create Date: 2026-07-28 08:15:16.196174

Extends the RBAC permission catalog (introduced in 7a1546165120) with four
more keys for the next batch of migrated endpoints: projects.py,
resources.py, assignments.py, resource_requests.py, and the non-journal-entry
parts of accounting.py (chart of accounts, ledger groups, cost centers, tax
rates, bank reconciliation). Also grants the new keys to the "full access"
roles seeded by the first migration (Admin, CEO, COO, CTO) - a brand new
permission key doesn't retroactively apply to roles that already existed,
even ones meant to have everything.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb8040b99176'
down_revision: Union[str, Sequence[str], None] = '7a1546165120'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = [
    ("projects.manage", "Employees", "Create, edit, delete projects and manage project members"),
    ("resources.manage", "Employees", "Create, edit, delete resources and approve/reject resource requests"),
    ("assignments.manage", "Employees", "Create, edit, delete, and return resource/project assignments"),
    ("accounting.manage", "Finance", "Manage chart of accounts, ledger groups, cost centers, tax rates, and bank reconciliation"),
]

FULL_ACCESS_ROLE_NAMES = ["Admin", "CEO", "COO", "CTO"]


def upgrade() -> None:
    bind = op.get_bind()

    permissions_t = sa.table(
        'permissions',
        sa.column('key', sa.String), sa.column('category', sa.String), sa.column('description', sa.String),
    )
    bind.execute(
        permissions_t.insert(),
        [{"key": k, "category": c, "description": d} for k, c, d in NEW_PERMISSIONS],
    )

    role_permissions_t = sa.table(
        'role_permissions',
        sa.column('id', sa.Integer), sa.column('role_id', sa.Integer), sa.column('permission_key', sa.String),
    )

    role_rows = bind.execute(
        sa.text("SELECT id FROM roles WHERE name = ANY(:names)"),
        {"names": FULL_ACCESS_ROLE_NAMES},
    ).fetchall()

    bind.execute(
        role_permissions_t.insert(),
        [
            {"role_id": role_id, "permission_key": key}
            for (role_id,) in role_rows
            for key, _, _ in NEW_PERMISSIONS
        ],
    )


def downgrade() -> None:
    bind = op.get_bind()
    keys = [k for k, _, _ in NEW_PERMISSIONS]
    bind.execute(sa.text("DELETE FROM role_permissions WHERE permission_key = ANY(:keys)"), {"keys": keys})
    bind.execute(sa.text("DELETE FROM approval_limits WHERE permission_key = ANY(:keys)"), {"keys": keys})
    bind.execute(sa.text("DELETE FROM permissions WHERE key = ANY(:keys)"), {"keys": keys})
