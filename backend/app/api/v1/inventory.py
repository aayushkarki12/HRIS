import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_manager_user, get_current_tenant
from ...core.audit import record_audit_log
from ...core.inventory_service import record_stock_in, record_stock_out, record_transfer, get_stock_position
from ...models.user import User
from ...models.tenant import Tenant
from ...models.inventory import Warehouse, ItemCategory, UnitOfMeasure, Supplier, Item, StockMovement
from ...schemas.inventory import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    ItemCategoryCreate, ItemCategoryUpdate, ItemCategoryResponse,
    UnitOfMeasureCreate, UnitOfMeasureUpdate, UnitOfMeasureResponse,
    SupplierCreate, SupplierUpdate, SupplierResponse,
    ItemCreate, ItemUpdate, ItemResponse,
    StockInRequest, StockOutRequest, StockTransferRequest, StockMovementResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inventory", tags=["inventory"])


# ============================================
# WAREHOUSES
# ============================================

@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_warehouses(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(Warehouse).filter(Warehouse.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(Warehouse.is_active == is_active)
    return query.order_by(Warehouse.code).all()


@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    data: WarehouseCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    existing = db.query(Warehouse).filter(Warehouse.tenant_id == tenant.id, Warehouse.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="A warehouse with this code already exists")
    wh = Warehouse(**data.model_dump(), tenant_id=tenant.id)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


@router.put("/warehouses/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(
    warehouse_id: int, data: WarehouseUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id, Warehouse.tenant_id == tenant.id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(wh, key, value)
    db.commit()
    db.refresh(wh)
    return wh


@router.delete("/warehouses/{warehouse_id}")
def deactivate_warehouse(
    warehouse_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id, Warehouse.tenant_id == tenant.id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    wh.is_active = False
    db.commit()
    return {"message": "Warehouse deactivated successfully"}


# ============================================
# ITEM CATEGORIES
# ============================================

@router.get("/categories", response_model=List[ItemCategoryResponse])
def get_categories(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(ItemCategory).filter(ItemCategory.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(ItemCategory.is_active == is_active)
    return query.order_by(ItemCategory.code).all()


@router.post("/categories", response_model=ItemCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: ItemCategoryCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    existing = db.query(ItemCategory).filter(ItemCategory.tenant_id == tenant.id, ItemCategory.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="A category with this code already exists")
    cat = ItemCategory(**data.model_dump(), tenant_id=tenant.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/categories/{category_id}", response_model=ItemCategoryResponse)
def update_category(
    category_id: int, data: ItemCategoryUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    cat = db.query(ItemCategory).filter(ItemCategory.id == category_id, ItemCategory.tenant_id == tenant.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}")
def deactivate_category(
    category_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    cat = db.query(ItemCategory).filter(ItemCategory.id == category_id, ItemCategory.tenant_id == tenant.id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    db.commit()
    return {"message": "Category deactivated successfully"}


# ============================================
# UNITS OF MEASURE
# ============================================

@router.get("/units", response_model=List[UnitOfMeasureResponse])
def get_units(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(UnitOfMeasure).filter(UnitOfMeasure.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(UnitOfMeasure.is_active == is_active)
    return query.order_by(UnitOfMeasure.code).all()


@router.post("/units", response_model=UnitOfMeasureResponse, status_code=status.HTTP_201_CREATED)
def create_unit(
    data: UnitOfMeasureCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    existing = db.query(UnitOfMeasure).filter(UnitOfMeasure.tenant_id == tenant.id, UnitOfMeasure.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="A unit with this code already exists")
    unit = UnitOfMeasure(**data.model_dump(), tenant_id=tenant.id)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.put("/units/{unit_id}", response_model=UnitOfMeasureResponse)
def update_unit(
    unit_id: int, data: UnitOfMeasureUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    unit = db.query(UnitOfMeasure).filter(UnitOfMeasure.id == unit_id, UnitOfMeasure.tenant_id == tenant.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(unit, key, value)
    db.commit()
    db.refresh(unit)
    return unit


@router.delete("/units/{unit_id}")
def deactivate_unit(
    unit_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    unit = db.query(UnitOfMeasure).filter(UnitOfMeasure.id == unit_id, UnitOfMeasure.tenant_id == tenant.id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    unit.is_active = False
    db.commit()
    return {"message": "Unit deactivated successfully"}


# ============================================
# SUPPLIERS
# ============================================

@router.get("/suppliers", response_model=List[SupplierResponse])
def get_suppliers(
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(Supplier).filter(Supplier.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(Supplier.is_active == is_active)
    if search:
        query = query.filter((Supplier.name.contains(search)) | (Supplier.code.contains(search)))
    return query.order_by(Supplier.name).all()


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    existing = db.query(Supplier).filter(Supplier.tenant_id == tenant.id, Supplier.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="A supplier with this code already exists")
    supplier = Supplier(**data.model_dump(), tenant_id=tenant.id)
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int, data: SupplierUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.tenant_id == tenant.id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/suppliers/{supplier_id}")
def deactivate_supplier(
    supplier_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.tenant_id == tenant.id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.is_active = False
    db.commit()
    return {"message": "Supplier deactivated successfully"}


# ============================================
# ITEMS
# ============================================

def _hydrate_item(db: Session, tenant_id: int, item: Item) -> Item:
    qty, avg_cost = get_stock_position(db, tenant_id, item.id)
    item.on_hand_quantity = round(qty, 4)
    item.average_cost = round(avg_cost, 4)
    item.stock_value = round(qty * avg_cost, 2)
    return item


@router.get("/items", response_model=List[ItemResponse])
def get_items(
    is_active: Optional[bool] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    low_stock_only: bool = False,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(Item).filter(Item.tenant_id == tenant.id)
    if is_active is not None:
        query = query.filter(Item.is_active == is_active)
    if category_id:
        query = query.filter(Item.category_id == category_id)
    if search:
        query = query.filter((Item.name.contains(search)) | (Item.sku.contains(search)))
    items = query.order_by(Item.sku).all()
    items = [_hydrate_item(db, tenant.id, i) for i in items]
    if low_stock_only:
        items = [i for i in items if i.on_hand_quantity <= i.reorder_level]
    return items


@router.get("/items/{item_id}", response_model=ItemResponse)
def get_item(
    item_id: int,
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == item_id, Item.tenant_id == tenant.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _hydrate_item(db, tenant.id, item)


@router.post("/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    data: ItemCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    existing = db.query(Item).filter(Item.tenant_id == tenant.id, Item.sku == data.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="An item with this SKU already exists")

    payload = data.model_dump(exclude={"opening_quantity", "opening_warehouse_id", "opening_unit_cost"})
    item = Item(**payload, tenant_id=tenant.id)
    db.add(item)
    db.flush()

    if data.opening_quantity > 0:
        if not data.opening_warehouse_id:
            raise HTTPException(status_code=400, detail="opening_warehouse_id is required when opening_quantity is set")
        warehouse = db.query(Warehouse).filter(Warehouse.id == data.opening_warehouse_id, Warehouse.tenant_id == tenant.id).first()
        if not warehouse:
            raise HTTPException(status_code=404, detail="Opening warehouse not found")
        record_stock_in(
            db, tenant, current_user, item, data.opening_warehouse_id,
            data.opening_quantity, data.opening_unit_cost, reference_type="opening",
            notes="Opening stock",
        )

    record_audit_log(db, tenant.id, current_user.id, "create", "item", item.id,
                      f"Created item {item.sku} - {item.name}")
    db.commit()
    db.refresh(item)
    return _hydrate_item(db, tenant.id, item)


@router.put("/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int, data: ItemUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == item_id, Item.tenant_id == tenant.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = data.model_dump(exclude_unset=True)
    if "sku" in update_data and update_data["sku"] != item.sku:
        existing = db.query(Item).filter(
            Item.tenant_id == tenant.id, Item.sku == update_data["sku"], Item.id != item_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="An item with this SKU already exists")

    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _hydrate_item(db, tenant.id, item)


@router.delete("/items/{item_id}")
def deactivate_item(
    item_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == item_id, Item.tenant_id == tenant.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()
    return {"message": "Item deactivated successfully"}


# ============================================
# STOCK MOVEMENTS
# ============================================

@router.get("/movements", response_model=List[StockMovementResponse])
def get_movements(
    item_id: Optional[int] = None,
    warehouse_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    query = db.query(StockMovement).filter(StockMovement.tenant_id == tenant.id)
    if item_id:
        query = query.filter(StockMovement.item_id == item_id)
    if warehouse_id:
        query = query.filter(StockMovement.warehouse_id == warehouse_id)
    return query.order_by(StockMovement.id.desc()).offset(skip).limit(limit).all()


@router.post("/movements/stock-in", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def stock_in(
    data: StockInRequest,
    contra_account_id: Optional[int] = None,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == data.item_id, Item.tenant_id == tenant.id, Item.is_active == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == data.warehouse_id, Warehouse.tenant_id == tenant.id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if data.post_voucher and not contra_account_id:
        raise HTTPException(status_code=400, detail="contra_account_id is required to post a voucher for stock in")

    try:
        movement = record_stock_in(
            db, tenant, current_user, item, data.warehouse_id, data.quantity, data.unit_cost,
            reference_type=data.reference_type, reference_number=data.reference_number,
            notes=data.notes, post_voucher=data.post_voucher, contra_account_id=contra_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    record_audit_log(db, tenant.id, current_user.id, "stock_in", "item", item.id,
                      f"Received {data.quantity} {item.sku} into {warehouse.code}")
    db.commit()
    db.refresh(movement)
    return movement


@router.post("/movements/stock-out", response_model=StockMovementResponse, status_code=status.HTTP_201_CREATED)
def stock_out(
    data: StockOutRequest,
    contra_account_id: Optional[int] = None,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == data.item_id, Item.tenant_id == tenant.id, Item.is_active == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    warehouse = db.query(Warehouse).filter(Warehouse.id == data.warehouse_id, Warehouse.tenant_id == tenant.id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if data.post_voucher and data.reference_type in ("adjustment", "damaged") and not contra_account_id:
        raise HTTPException(status_code=400, detail="contra_account_id is required to post a voucher for this movement type")

    try:
        movement = record_stock_out(
            db, tenant, current_user, item, data.warehouse_id, data.quantity,
            reference_type=data.reference_type, reference_number=data.reference_number,
            notes=data.notes, post_voucher=data.post_voucher, contra_account_id=contra_account_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    record_audit_log(db, tenant.id, current_user.id, "stock_out", "item", item.id,
                      f"Issued {data.quantity} {item.sku} from {warehouse.code}")
    db.commit()
    db.refresh(movement)
    return movement


@router.post("/movements/transfer", status_code=status.HTTP_201_CREATED)
def stock_transfer(
    data: StockTransferRequest,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    item = db.query(Item).filter(Item.id == data.item_id, Item.tenant_id == tenant.id, Item.is_active == True).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        out_mv, in_mv = record_transfer(
            db, tenant, current_user, item, data.from_warehouse_id, data.to_warehouse_id,
            data.quantity, notes=data.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    record_audit_log(db, tenant.id, current_user.id, "stock_transfer", "item", item.id,
                      f"Transferred {data.quantity} {item.sku} between warehouses")
    db.commit()
    return {
        "message": "Transfer completed",
        "out_movement": StockMovementResponse.model_validate(out_mv),
        "in_movement": StockMovementResponse.model_validate(in_mv),
    }


# ============================================
# DASHBOARD
# ============================================

@router.get("/dashboard")
def get_inventory_dashboard(
    current_user: User = Depends(get_current_manager_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Current stock, low stock, out of stock, valuation - across all active items."""
    items = db.query(Item).filter(Item.tenant_id == tenant.id, Item.is_active == True).all()
    warehouses = db.query(Warehouse).filter(Warehouse.tenant_id == tenant.id, Warehouse.is_active == True).count()

    total_value = 0.0
    low_stock = []
    out_of_stock = []
    item_summaries = []

    for item in items:
        qty, avg_cost = get_stock_position(db, tenant.id, item.id)
        value = round(qty * avg_cost, 2)
        total_value += value
        summary = {
            "item_id": item.id, "sku": item.sku, "name": item.name,
            "on_hand_quantity": round(qty, 4), "average_cost": round(avg_cost, 4),
            "stock_value": value, "reorder_level": item.reorder_level,
        }
        item_summaries.append(summary)
        if qty <= 0:
            out_of_stock.append(summary)
        elif qty <= item.reorder_level:
            low_stock.append(summary)

    # Fast moving: items with the most stock-out (sale) movements in recent history.
    fast_moving_rows = db.query(
        StockMovement.item_id, func.count(StockMovement.id).label("movement_count")
    ).filter(
        StockMovement.tenant_id == tenant.id, StockMovement.movement_type == "sale"
    ).group_by(StockMovement.item_id).order_by(func.count(StockMovement.id).desc()).limit(5).all()
    item_by_id = {i.id: i for i in items}
    fast_moving = [
        {"item_id": r[0], "sku": item_by_id[r[0]].sku, "name": item_by_id[r[0]].name, "movement_count": r[1]}
        for r in fast_moving_rows if r[0] in item_by_id
    ]

    return {
        "total_items": len(items),
        "total_warehouses": warehouses,
        "total_stock_value": round(total_value, 2),
        "low_stock_count": len(low_stock),
        "out_of_stock_count": len(out_of_stock),
        "low_stock_items": low_stock,
        "out_of_stock_items": out_of_stock,
        "fast_moving_items": fast_moving,
    }
