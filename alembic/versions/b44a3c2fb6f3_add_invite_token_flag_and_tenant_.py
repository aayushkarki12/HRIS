"""add invite token flag and tenant prefixed employee ids

Revision ID: b44a3c2fb6f3
Revises: a791954f2edd
Create Date: 2026-07-28 10:00:51.129689

Adds PasswordResetToken.is_invite (separates "new employee, set your
username/password" links from ordinary "forgot password" links) and
renumbers existing Employee.employee_id values from the old EMP0001 scheme
to a tenant-name-prefixed one (e.g. "Cantor Dust" -> CD_001, CD_002, ...),
oldest-first per tenant, so the admin's own employee record becomes _001.
Safe to renumber - nothing else joins on the employee_id string (see
app/api/v1/employees.py::_generate_employee_id for the same prefix logic
used going forward).
"""
import re
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b44a3c2fb6f3'
down_revision: Union[str, Sequence[str], None] = 'a791954f2edd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tenant_id_prefix(tenant_name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", tenant_name or "")
    if len(words) >= 2:
        prefix = "".join(w[0] for w in words[:4]).upper()
    elif words:
        prefix = words[0][:3].upper()
    else:
        prefix = ""
    return prefix or "EMP"


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    columns = {c["name"] for c in inspector.get_columns("password_reset_tokens")}
    if "is_invite" not in columns:
        op.add_column(
            "password_reset_tokens",
            sa.Column("is_invite", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    tenants = bind.execute(sa.text("SELECT id, name FROM tenants")).fetchall()
    for tenant_id, tenant_name in tenants:
        prefix = _tenant_id_prefix(tenant_name)
        employees = bind.execute(
            sa.text("SELECT id, employee_id FROM employees WHERE tenant_id = :tid ORDER BY created_at, id"),
            {"tid": tenant_id},
        ).fetchall()
        for seq, (emp_id, old_employee_id) in enumerate(employees, start=1):
            new_employee_id = f"{prefix}_{seq:03d}"
            if new_employee_id != old_employee_id:
                bind.execute(
                    sa.text("UPDATE employees SET employee_id = :new_id WHERE id = :id"),
                    {"new_id": new_employee_id, "id": emp_id},
                )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {c["name"] for c in inspector.get_columns("password_reset_tokens")}
    if "is_invite" in columns:
        op.drop_column("password_reset_tokens", "is_invite")
    # employee_id renumbering is not reversible - the old EMP0001 values
    # aren't recorded anywhere once overwritten.
