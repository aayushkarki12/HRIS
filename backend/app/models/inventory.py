from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, UniqueConstraint, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..core.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_warehouses_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")


class ItemCategory(Base):
    __tablename__ = "item_categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_item_categories_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    parent_id = Column(Integer, ForeignKey("item_categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    parent = relationship("ItemCategory", remote_side=[id], backref="children")


class UnitOfMeasure(Base):
    __tablename__ = "units_of_measure"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_units_of_measure_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(10), nullable=False)  # e.g. PCS, KG, LTR
    name = Column(String(50), nullable=False)  # e.g. Pieces, Kilograms, Litres
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")


class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_suppliers_tenant_code"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(150), nullable=False)
    email = Column(String(100), nullable=True)
    phone = Column(String(30), nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")


class Item(Base):
    """
    A stock-keeping unit. Costing is weighted-average, tracked via the running
    `average_cost` maintained on each StockMovement row for this item - not a
    separate ledger, to avoid a second source of truth for on-hand value.
    """
    __tablename__ = "items"
    __table_args__ = (
        UniqueConstraint("tenant_id", "sku", name="uq_items_tenant_sku"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    sku = Column(String(30), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("item_categories.id"), nullable=True)
    unit_id = Column(Integer, ForeignKey("units_of_measure.id"), nullable=True)
    default_supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    cost_price = Column(Float, default=0)  # last/standard purchase cost, informational
    sale_price = Column(Float, default=0)
    reorder_level = Column(Float, default=0)
    min_stock = Column(Float, default=0)
    max_stock = Column(Float, nullable=True)
    # Optional links so stock movements can generate accounting vouchers - if either is
    # unset, movements for this item simply skip voucher creation (inventory tracking
    # still works without a chart-of-accounts setup for it).
    inventory_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    cogs_account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    tenant = relationship("Tenant")
    category = relationship("ItemCategory")
    unit = relationship("UnitOfMeasure")
    default_supplier = relationship("Supplier")
    inventory_account = relationship("Account", foreign_keys=[inventory_account_id])
    cogs_account = relationship("Account", foreign_keys=[cogs_account_id])


class StockMovement(Base):
    """
    Append-only stock ledger line. Every change in on-hand quantity for an
    item/warehouse pair is one row here - opening balance, purchase receipt,
    sale issue, transfer leg, adjustment, or damage write-off. Running
    quantity and weighted-average cost are computed and stored per row at
    write time so the ledger can be displayed without recomputing history.
    """
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_stock_movements_tenant_item_warehouse", "tenant_id", "item_id", "warehouse_id"),
        Index("ix_stock_movements_tenant_date", "tenant_id", "movement_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    movement_date = Column(DateTime(timezone=True), server_default=func.now())
    movement_type = Column(String(20), nullable=False)
    # opening | purchase | sale | transfer_in | transfer_out | adjustment | damaged | reserved | released
    quantity = Column(Float, nullable=False)  # always positive; direction implied by movement_type
    unit_cost = Column(Float, nullable=False, default=0)  # cost per unit for this movement (in for purchases/opening, running avg for out)
    running_quantity = Column(Float, nullable=False)  # on-hand qty for this item/warehouse after this movement
    running_average_cost = Column(Float, nullable=False, default=0)  # weighted-average unit cost after this movement
    related_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)  # the other leg of a transfer
    reference_type = Column(String(20), nullable=True)  # purchase | sale | manual | transfer | adjustment | damaged
    reference_id = Column(Integer, nullable=True)
    voucher_id = Column(Integer, ForeignKey("vouchers.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")
    item = relationship("Item")
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    related_warehouse = relationship("Warehouse", foreign_keys=[related_warehouse_id])
    voucher = relationship("Voucher")
    creator = relationship("User")
