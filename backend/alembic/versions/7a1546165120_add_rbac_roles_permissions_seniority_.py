"""add rbac roles permissions seniority approval limits

Revision ID: 7a1546165120
Revises: f0c03dd3b0c9
Create Date: 2026-07-28 07:35:37.949588

Introduces the new RBAC layer (see app/models/rbac.py and
app/core/permissions.py) alongside the existing User.role string, which
stays in place during the rollout:

- permissions: fixed catalog, seeded from app.core.permissions.PERMISSIONS.
- roles: admin-manageable named roles/designations, tenant-scoped. Seeds
  three system roles (Admin/Manager/Employee) per existing tenant, mapped
  from the legacy User.role values, plus a handful of example designations
  (CEO/COO/CTO/HR Manager/Accountant/Developer) admins can rename, delete,
  or reassign permissions on freely.
- role_permissions: which permissions each seeded role starts with.
- seniority_levels: Junior/Mid/Senior/Lead per existing tenant.
- approval_limits: a few illustrative example limits on the Accountant
  role, demonstrating the seniority-gates-amount mechanism.
- users.role_id / employees.seniority_level_id: new nullable FKs. Existing
  users are backfilled onto the matching system role by their legacy
  `role` string.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1546165120'
down_revision: Union[str, Sequence[str], None] = 'f0c03dd3b0c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Kept in sync by hand with app.core.permissions.PERMISSIONS - migrations
# should be self-contained rather than importing app code that might change
# shape later.
PERMISSIONS = [
    ("users.manage", "Administration", "Create, edit, deactivate, and reset passwords for other users"),
    ("tenant.manage", "Administration", "Edit tenant/company settings"),
    ("roles.manage", "Administration", "Create/edit roles, permissions, seniority levels, and approval limits"),
    ("audit_log.view", "Administration", "View the audit trail"),
    ("employees.view_all", "Employees", "View every employee, not just their own department"),
    ("employees.edit", "Employees", "Create and edit employee records"),
    ("employees.view_sensitive", "Employees", "View bank account and social security details for other employees"),
    ("leave.approve", "Leave & Attendance", "Approve or reject leave requests"),
    ("timesheet.approve", "Leave & Attendance", "Approve timesheets"),
    ("attendance.manage", "Leave & Attendance", "Manage attendance records and work locations"),
    ("documents.verify", "Leave & Attendance", "Verify uploaded employee documents"),
    ("voucher.create", "Finance", "Create vouchers"),
    ("voucher.approve", "Finance", "Approve submitted vouchers"),
    ("voucher.post", "Finance", "Post vouchers to the general ledger"),
    ("journal_entry.manage", "Finance", "Create and post journal entries directly"),
    ("invoice.manage", "Finance", "Create and send invoices"),
    ("invoice.approve", "Finance", "Record payments against invoices"),
    ("expense.approve_manager", "Finance", "Give first (manager) approval on expense claims"),
    ("expense.approve_accounting", "Finance", "Give final (accounting) approval and release payment on expense claims"),
    ("budget.approve", "Finance", "Approve submitted budgets"),
    ("payroll.manage", "Finance", "Run payroll and manage salary structures"),
    ("payroll.view_all", "Finance", "View every employee's salary, not just their own"),
    ("inventory.manage", "Finance", "Manage warehouses, items, and stock movements"),
    ("reports.financial.view", "Finance", "View financial reports and the general ledger"),
]
ALL_KEYS = [p[0] for p in PERMISSIONS]

MANAGER_PERMISSIONS = [
    "employees.view_all", "employees.view_sensitive", "leave.approve", "timesheet.approve",
    "attendance.manage", "documents.verify", "expense.approve_manager", "audit_log.view",
    "reports.financial.view",
]
HR_MANAGER_PERMISSIONS = [
    "employees.view_all", "employees.edit", "employees.view_sensitive", "leave.approve",
    "timesheet.approve", "attendance.manage", "documents.verify", "audit_log.view",
]
ACCOUNTANT_PERMISSIONS = [
    "voucher.create", "voucher.approve", "voucher.post", "journal_entry.manage",
    "invoice.manage", "invoice.approve", "expense.approve_manager", "expense.approve_accounting",
    "budget.approve", "payroll.manage", "payroll.view_all", "inventory.manage",
    "reports.financial.view", "audit_log.view",
]

# name, is_system, permission set
SEEDED_ROLES = [
    ("Admin", True, ALL_KEYS),
    ("Manager", True, MANAGER_PERMISSIONS),
    ("Employee", True, []),
    ("CEO", False, ALL_KEYS),
    ("COO", False, ALL_KEYS),
    ("CTO", False, ALL_KEYS),
    ("HR Manager", False, HR_MANAGER_PERMISSIONS),
    ("Accountant", False, ACCOUNTANT_PERMISSIONS),
    ("Developer", False, []),
]

SENIORITY_LEVELS = [("Junior", 1), ("Mid", 2), ("Senior", 3), ("Lead", 4)]

# (seniority name, permission_key, max_amount) - illustrative examples on
# the Accountant role only; Senior/Lead are left unlimited (no row).
ACCOUNTANT_APPROVAL_LIMITS = [
    ("Junior", "expense.approve_accounting", 500),
    ("Junior", "invoice.approve", 1000),
    ("Junior", "voucher.approve", 1000),
    ("Junior", "budget.approve", 5000),
    ("Mid", "expense.approve_accounting", 5000),
    ("Mid", "invoice.approve", 10000),
    ("Mid", "voucher.approve", 10000),
    ("Mid", "budget.approve", 50000),
]


def upgrade() -> None:
    op.create_table(
        'permissions',
        sa.Column('key', sa.String(length=60), primary_key=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
    )

    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_roles_tenant_name'),
    )

    op.create_table(
        'role_permissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=False),
        sa.Column('permission_key', sa.String(length=60), sa.ForeignKey('permissions.key'), nullable=False),
        sa.UniqueConstraint('role_id', 'permission_key', name='uq_role_permission'),
    )

    op.create_table(
        'seniority_levels',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_seniority_tenant_name'),
    )

    op.create_table(
        'approval_limits',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=True),
        sa.Column('seniority_level_id', sa.Integer(), sa.ForeignKey('seniority_levels.id'), nullable=True),
        sa.Column('permission_key', sa.String(length=60), sa.ForeignKey('permissions.key'), nullable=False),
        sa.Column('max_amount', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('tenant_id', 'role_id', 'seniority_level_id', 'permission_key', name='uq_approval_limit'),
    )

    op.add_column('users', sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id'), nullable=True))
    op.add_column('employees', sa.Column('seniority_level_id', sa.Integer(), sa.ForeignKey('seniority_levels.id'), nullable=True))

    # ---- seed data ----
    bind = op.get_bind()

    permissions_t = sa.table(
        'permissions',
        sa.column('key', sa.String), sa.column('category', sa.String), sa.column('description', sa.String),
    )
    bind.execute(
        permissions_t.insert(),
        [{"key": k, "category": c, "description": d} for k, c, d in PERMISSIONS],
    )

    roles_t = sa.table(
        'roles',
        sa.column('id', sa.Integer), sa.column('tenant_id', sa.Integer), sa.column('name', sa.String),
        sa.column('is_system', sa.Boolean),
    )
    role_permissions_t = sa.table(
        'role_permissions',
        sa.column('id', sa.Integer), sa.column('role_id', sa.Integer), sa.column('permission_key', sa.String),
    )
    seniority_t = sa.table(
        'seniority_levels',
        sa.column('id', sa.Integer), sa.column('tenant_id', sa.Integer), sa.column('name', sa.String),
        sa.column('rank', sa.Integer),
    )
    approval_limits_t = sa.table(
        'approval_limits',
        sa.column('id', sa.Integer), sa.column('tenant_id', sa.Integer), sa.column('role_id', sa.Integer),
        sa.column('seniority_level_id', sa.Integer), sa.column('permission_key', sa.String),
        sa.column('max_amount', sa.Float),
    )
    users_t = sa.table(
        'users',
        sa.column('id', sa.Integer), sa.column('tenant_id', sa.Integer), sa.column('role', sa.String),
        sa.column('role_id', sa.Integer),
    )

    tenant_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM tenants")).fetchall()]

    for tenant_id in tenant_ids:
        role_id_by_name = {}
        for name, is_system, perm_keys in SEEDED_ROLES:
            result = bind.execute(
                roles_t.insert().returning(roles_t.c.id),
                {"tenant_id": tenant_id, "name": name, "is_system": is_system},
            )
            role_id = result.scalar_one()
            role_id_by_name[name] = role_id
            if perm_keys:
                bind.execute(
                    role_permissions_t.insert(),
                    [{"role_id": role_id, "permission_key": key} for key in perm_keys],
                )

        seniority_id_by_name = {}
        for name, rank in SENIORITY_LEVELS:
            result = bind.execute(
                seniority_t.insert().returning(seniority_t.c.id),
                {"tenant_id": tenant_id, "name": name, "rank": rank},
            )
            seniority_id_by_name[name] = result.scalar_one()

        accountant_role_id = role_id_by_name["Accountant"]
        bind.execute(
            approval_limits_t.insert(),
            [
                {
                    "tenant_id": tenant_id,
                    "role_id": accountant_role_id,
                    "seniority_level_id": seniority_id_by_name[seniority_name],
                    "permission_key": key,
                    "max_amount": amount,
                }
                for seniority_name, key, amount in ACCOUNTANT_APPROVAL_LIMITS
            ],
        )

        # Backfill existing users in this tenant onto the matching system role.
        legacy_to_system_role = {"admin": "Admin", "manager": "Manager", "user": "Employee"}
        for legacy_role, system_role_name in legacy_to_system_role.items():
            bind.execute(
                sa.update(users_t)
                .where(users_t.c.tenant_id == tenant_id, users_t.c.role == legacy_role)
                .values(role_id=role_id_by_name[system_role_name])
            )
        # Anything with an unrecognized legacy role value falls back to Employee.
        bind.execute(
            sa.update(users_t)
            .where(users_t.c.tenant_id == tenant_id, users_t.c.role_id.is_(None))
            .values(role_id=role_id_by_name["Employee"])
        )


def downgrade() -> None:
    op.drop_column('employees', 'seniority_level_id')
    op.drop_column('users', 'role_id')
    op.drop_table('approval_limits')
    op.drop_table('seniority_levels')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')
