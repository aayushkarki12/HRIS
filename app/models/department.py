from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Department(Base):
    """An admin-manageable named department (Development, Editing, HR, Accounts,
    ...). Employee.department stays a plain string rather than a foreign key to
    this table - this is a picklist the admin UI offers, not a referential
    constraint, so existing free-text department values on Employee keep working
    even before an admin has curated the list."""
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_departments_tenant_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String(80), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
