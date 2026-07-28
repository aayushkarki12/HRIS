"""Role-based access control: admin-manageable named roles/designations, a
code-defined permission catalog, which permissions each role grants, and
optional per-role/per-seniority numeric ceilings on money-handling
permissions (e.g. a Junior Accountant can approve smaller expense claims
than a Senior one).

Design intent, since this replaces a hardcoded 3-role system:
- `Permission` is a fixed, code-defined catalog (see app/core/permissions.py)
  that mirrors actual enforcement points in the backend - it is NOT
  admin-creatable, since a permission with no corresponding check anywhere
  would be meaningless. It is tenant-agnostic (shared catalog for everyone).
- `Role` IS the "designation" the user asked for - admin-created, named
  anything (CEO, Accountant, Developer, ...), tenant-scoped, and it carries
  whatever permissions the admin assigns via RolePermission. There is no
  separate "designation" concept - one named, permission-bearing thing.
- `SeniorityLevel` is a separate per-tenant axis (Junior/Mid/Senior/Lead)
  assigned on Employee, independent of Role.
- `ApprovalLimit` only NARROWS a permission a role already has via
  RolePermission - it can never grant access on its own. If a role has a
  money-handling permission and no ApprovalLimit row matches, that
  permission is unlimited for that role/seniority combination.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Permission(Base):
    """The fixed catalog of capabilities the backend actually checks for.
    Seeded once from app.core.permissions.PERMISSIONS - not tenant-scoped
    and not created/edited through the admin UI, only referenced by it."""
    __tablename__ = "permissions"

    key = Column(String(60), primary_key=True)  # e.g. "employees.edit"
    category = Column(String(50), nullable=False)  # e.g. "Employees" - groups the admin UI's checkbox matrix
    description = Column(String(255), nullable=False)


class Role(Base):
    """An admin-manageable named role/designation (CEO, Accountant, Admin, ...)."""
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_roles_tenant_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(80), nullable=False)
    description = Column(String(255), nullable=True)
    # Admin/Manager/Employee are seeded per tenant and can't be deleted -
    # every tenant needs at least one role with full access, and existing
    # users are backfilled onto these three when this system is introduced.
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    role_permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class RolePermission(Base):
    """Grants one permission to one role. Admin toggles these via a checkbox matrix."""
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_key", name="uq_role_permission"),
    )

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    permission_key = Column(String(60), ForeignKey("permissions.key"), nullable=False)

    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission")


class SeniorityLevel(Base):
    """Junior/Mid/Senior/Lead, etc. - independent of Role, assigned on Employee."""
    __tablename__ = "seniority_levels"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_seniority_tenant_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(50), nullable=False)
    rank = Column(Integer, nullable=False, default=0)  # higher = more senior; used to order the admin UI
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")


class ApprovalLimit(Base):
    """A numeric ceiling on one money-handling permission for a role and/or
    seniority level. Both role_id and seniority_level_id are nullable so a
    limit can apply to "any role at this seniority", "this role at any
    seniority", or (both set) an exact combination. Lookup picks the most
    specific match; see app/core/permissions.py::get_approval_limit."""
    __tablename__ = "approval_limits"
    __table_args__ = (
        UniqueConstraint("tenant_id", "role_id", "seniority_level_id", "permission_key", name="uq_approval_limit"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    seniority_level_id = Column(Integer, ForeignKey("seniority_levels.id"), nullable=True)
    permission_key = Column(String(60), ForeignKey("permissions.key"), nullable=False)
    max_amount = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    role = relationship("Role")
    seniority_level = relationship("SeniorityLevel")
    permission = relationship("Permission")
