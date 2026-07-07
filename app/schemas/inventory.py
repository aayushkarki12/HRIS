from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============ Warehouse ============

class WarehouseBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    address: Optional[str] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    address: Optional[str] = None
    is_active: Optional[bool] = None


class WarehouseResponse(WarehouseBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Item Category ============

class ItemCategoryBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=100)
    parent_id: Optional[int] = None
    is_active: bool = True


class ItemCategoryCreate(ItemCategoryBase):
    pass


class ItemCategoryUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None


class ItemCategoryResponse(ItemCategoryBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Unit of Measure ============

class UnitOfMeasureBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=10)
    name: str = Field(..., min_length=1, max_length=50)
    is_active: bool = True


class UnitOfMeasureCreate(UnitOfMeasureBase):
    pass


class UnitOfMeasureUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=10)
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    is_active: Optional[bool] = None


class UnitOfMeasureResponse(UnitOfMeasureBase):
    id: int
    tenant_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ============ Supplier ============

class SupplierBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=2, max_length=150)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=20)
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class SupplierResponse(SupplierBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Item ============

class ItemBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=30)
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    cost_price: float = Field(0, ge=0)
    sale_price: float = Field(0, ge=0)
    reorder_level: float = Field(0, ge=0)
    min_stock: float = Field(0, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    inventory_account_id: Optional[int] = None
    cogs_account_id: Optional[int] = None
    is_active: bool = True


class ItemCreate(ItemBase):
    opening_quantity: float = Field(0, ge=0)
    opening_warehouse_id: Optional[int] = None
    opening_unit_cost: float = Field(0, ge=0)


class ItemUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=30)
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    category_id: Optional[int] = None
    unit_id: Optional[int] = None
    default_supplier_id: Optional[int] = None
    cost_price: Optional[float] = Field(None, ge=0)
    sale_price: Optional[float] = Field(None, ge=0)
    reorder_level: Optional[float] = Field(None, ge=0)
    min_stock: Optional[float] = Field(None, ge=0)
    max_stock: Optional[float] = Field(None, ge=0)
    inventory_account_id: Optional[int] = None
    cogs_account_id: Optional[int] = None
    is_active: Optional[bool] = None


class ItemResponse(ItemBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    on_hand_quantity: float = 0
    average_cost: float = 0
    stock_value: float = 0

    class Config:
        from_attributes = True


# ============ Stock Movements ============

STOCK_MOVEMENT_TYPES = "^(purchase|sale|transfer|adjustment|damaged)$"


class StockInRequest(BaseModel):
    item_id: int
    warehouse_id: int
    quantity: float = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)
    reference_type: str = Field("purchase", pattern="^(purchase|adjustment)$")
    reference_number: Optional[str] = None
    supplier_id: Optional[int] = None
    notes: Optional[str] = None
    post_voucher: bool = False


class StockOutRequest(BaseModel):
    item_id: int
    warehouse_id: int
    quantity: float = Field(..., gt=0)
    reference_type: str = Field("sale", pattern="^(sale|adjustment|damaged)$")
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    post_voucher: bool = False


class StockTransferRequest(BaseModel):
    item_id: int
    from_warehouse_id: int
    to_warehouse_id: int
    quantity: float = Field(..., gt=0)
    notes: Optional[str] = None


class StockMovementResponse(BaseModel):
    id: int
    tenant_id: int
    item_id: int
    warehouse_id: int
    movement_date: datetime
    movement_type: str
    quantity: float
    unit_cost: float
    running_quantity: float
    running_average_cost: float
    related_warehouse_id: Optional[int] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    voucher_id: Optional[int] = None
    notes: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
