"""seed leave types and dossier annotation projects

Revision ID: 6640c125a7dc
Revises: b44a3c2fb6f3
Create Date: 2026-07-28 12:35:44.321403

No LeaveType rows existed at all, which meant the self-service "Apply for
Leave" dropdown was permanently empty and leave application was completely
non-functional. Seeds Sick/Casual/Annual per tenant (admin can add more via
the existing POST /leaves/types API). Also seeds the company's two real
project lines, Dossier and Annotation, as actual Project rows so employees
can be added as members and see it reflected on their own record.
"""
from datetime import date
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6640c125a7dc'
down_revision: Union[str, Sequence[str], None] = 'b44a3c2fb6f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# name, code, days_per_year, is_paid
LEAVE_TYPES = [
    ("Sick Leave", "SICK", 10, True),
    ("Casual Leave", "CASUAL", 7, True),
    ("Annual Leave", "ANNUAL", 15, True),
]

PROJECTS = ["Dossier", "Annotation"]


def upgrade() -> None:
    bind = op.get_bind()

    leave_types_t = sa.table(
        "leave_types",
        sa.column("id", sa.Integer), sa.column("tenant_id", sa.Integer), sa.column("name", sa.String),
        sa.column("code", sa.String), sa.column("days_per_year", sa.Float), sa.column("is_paid", sa.Boolean),
        sa.column("is_active", sa.Boolean),
    )
    projects_t = sa.table(
        "projects",
        sa.column("id", sa.Integer), sa.column("tenant_id", sa.Integer), sa.column("name", sa.String),
        sa.column("description", sa.Text), sa.column("status", sa.String), sa.column("start_date", sa.Date),
        sa.column("progress", sa.Integer), sa.column("budget", sa.Float),
    )

    tenant_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM tenants")).fetchall()]

    # leave_types.code is globally unique (not per-tenant) - fine for the
    # single-tenant deployment this runs against today, but a second tenant
    # seeding the same codes would collide and needs the codes namespaced
    # (e.g. "{tenant_id}-SICK") before this could support multiple tenants.
    existing_codes = {row[0] for row in bind.execute(sa.text("SELECT code FROM leave_types")).fetchall()}

    for tenant_id in tenant_ids:
        for name, code, days, is_paid in LEAVE_TYPES:
            if code not in existing_codes:
                bind.execute(leave_types_t.insert(), {
                    "tenant_id": tenant_id, "name": name, "code": code,
                    "days_per_year": days, "is_paid": is_paid, "is_active": True,
                })
                existing_codes.add(code)

        existing_projects = {
            row[0] for row in bind.execute(
                sa.text("SELECT name FROM projects WHERE tenant_id = :tid"), {"tid": tenant_id}
            ).fetchall()
        }
        for name in PROJECTS:
            if name not in existing_projects:
                bind.execute(projects_t.insert(), {
                    "tenant_id": tenant_id, "name": name,
                    "description": f"{name} business line",
                    "status": "active", "start_date": date.today(), "progress": 0, "budget": 0,
                })


def downgrade() -> None:
    bind = op.get_bind()
    codes = [c for _, c, _, _ in LEAVE_TYPES]
    bind.execute(sa.text("DELETE FROM leave_types WHERE code = ANY(:codes)"), {"codes": codes})
    bind.execute(sa.text("DELETE FROM projects WHERE name = ANY(:names)"), {"names": PROJECTS})
