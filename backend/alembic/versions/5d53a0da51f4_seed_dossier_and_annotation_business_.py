"""seed dossier and annotation business-line designations

Revision ID: 5d53a0da51f4
Revises: bb8040b99176
Create Date: 2026-07-28 08:24:31.009930

The company runs two kinds of work: the Dossier line (AI/software/pharma
regulatory - developers, QA, interns, project managers) and an Annotation
line (editors, annotators, associate project managers). Adds designations
covering both, on top of the CEO/COO/CTO/HR Manager/Accountant/Developer
set from the first RBAC migration. Project Manager and Team Lead are kept
generic (shared across both lines) rather than duplicated per line, since
which project someone works on is tracked via Project/Assignment, not via
their job title.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5d53a0da51f4'
down_revision: Union[str, Sequence[str], None] = 'bb8040b99176'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# name -> permission keys
NEW_ROLES = {
    "Project Manager": ["projects.manage", "resources.manage", "assignments.manage", "timesheet.approve"],
    "Associate Project Manager": ["assignments.manage", "timesheet.approve"],
    "Team Lead": ["leave.approve", "timesheet.approve"],
    "QA Engineer": [],
    "Intern": [],
    "Editor": [],
    "Senior Editor": [],
    "Annotator": [],
}


def upgrade() -> None:
    bind = op.get_bind()

    roles_t = sa.table(
        'roles',
        sa.column('id', sa.Integer), sa.column('tenant_id', sa.Integer), sa.column('name', sa.String),
        sa.column('is_system', sa.Boolean),
    )
    role_permissions_t = sa.table(
        'role_permissions',
        sa.column('id', sa.Integer), sa.column('role_id', sa.Integer), sa.column('permission_key', sa.String),
    )

    tenant_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM tenants")).fetchall()]

    for tenant_id in tenant_ids:
        existing_names = {
            row[0] for row in bind.execute(
                sa.text("SELECT name FROM roles WHERE tenant_id = :tid"), {"tid": tenant_id}
            ).fetchall()
        }
        for name, perm_keys in NEW_ROLES.items():
            if name in existing_names:
                continue
            result = bind.execute(
                roles_t.insert().returning(roles_t.c.id),
                {"tenant_id": tenant_id, "name": name, "is_system": False},
            )
            role_id = result.scalar_one()
            if perm_keys:
                bind.execute(
                    role_permissions_t.insert(),
                    [{"role_id": role_id, "permission_key": key} for key in perm_keys],
                )


def downgrade() -> None:
    bind = op.get_bind()
    names = list(NEW_ROLES.keys())
    role_ids = [row[0] for row in bind.execute(
        sa.text("SELECT id FROM roles WHERE name = ANY(:names) AND is_system = false"), {"names": names}
    ).fetchall()]
    if not role_ids:
        return
    bind.execute(sa.text("DELETE FROM role_permissions WHERE role_id = ANY(:ids)"), {"ids": role_ids})
    bind.execute(sa.text("DELETE FROM approval_limits WHERE role_id = ANY(:ids)"), {"ids": role_ids})
    bind.execute(sa.text("UPDATE users SET role_id = NULL WHERE role_id = ANY(:ids)"), {"ids": role_ids})
    bind.execute(sa.text("DELETE FROM roles WHERE id = ANY(:ids)"), {"ids": role_ids})
