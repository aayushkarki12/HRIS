"""
Stock ledger service - the single place that knows how to append a
StockMovement row and keep the running quantity / weighted-average cost
correct.
"""
from datetime import date
from typing import Optional
from sqlalchemy.orm import Session

from ..models.inventory import Item, StockMovement
from ..models.user import User
from ..models.tenant import Tenant


def _last_movement(
    db: Session, tenant_id: int, item_id: int, warehouse_id: int, for_update: bool = False
) -> Optional[StockMovement]:
    """The current tail of the ledger for one item/warehouse.

    With for_update=True this takes a row lock on that tail row, so a second
    concurrent caller for the same item+warehouse blocks until the first
    transaction commits or rolls back, instead of both reading the same
    stale running_quantity and both committing a movement against it (which
    is how stock gets oversold under concurrent stock-out requests).
    """
    query = db.query(StockMovement).filter(
        StockMovement.tenant_id == tenant_id,
        StockMovement.item_id == item_id,
        StockMovement.warehouse_id == warehouse_id,
    ).order_by(StockMovement.id.desc())
    if for_update:
        query = query.with_for_update()
    return query.first()


def get_stock_position(db: Session, tenant_id: int, item_id: int, warehouse_id: Optional[int] = None):
    """Current on-hand quantity and weighted-average cost, optionally scoped to one warehouse."""
    query = db.query(StockMovement).filter(
        StockMovement.tenant_id == tenant_id, StockMovement.item_id == item_id
    )
    if warehouse_id:
        last = query.filter(StockMovement.warehouse_id == warehouse_id).order_by(StockMovement.id.desc()).first()
        return (last.running_quantity, last.running_average_cost) if last else (0.0, 0.0)

    # No warehouse filter: aggregate the latest row per warehouse.
    warehouse_ids = [r[0] for r in db.query(StockMovement.warehouse_id).filter(
        StockMovement.tenant_id == tenant_id, StockMovement.item_id == item_id
    ).distinct().all()]
    total_qty = 0.0
    total_value = 0.0
    for wid in warehouse_ids:
        qty, avg_cost = get_stock_position(db, tenant_id, item_id, wid)
        total_qty += qty
        total_value += qty * avg_cost
    avg = (total_value / total_qty) if total_qty > 0 else 0.0
    return total_qty, avg


def record_stock_in(
    db: Session, tenant: Tenant, current_user: User, item: Item, warehouse_id: int,
    quantity: float, unit_cost: float, reference_type: str = "purchase",
    reference_number: Optional[str] = None, notes: Optional[str] = None,
    movement_date: Optional[date] = None,
) -> StockMovement:
    last = _last_movement(db, tenant.id, item.id, warehouse_id, for_update=True)
    old_qty = last.running_quantity if last else 0.0
    old_avg = last.running_average_cost if last else 0.0

    new_qty = old_qty + quantity
    new_avg = ((old_qty * old_avg) + (quantity * unit_cost)) / new_qty if new_qty > 0 else 0.0

    movement_type = "opening" if reference_type == "opening" else reference_type
    movement = StockMovement(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse_id,
        movement_type=movement_type, quantity=quantity, unit_cost=unit_cost,
        running_quantity=new_qty, running_average_cost=round(new_avg, 4),
        reference_type=reference_type, notes=notes, created_by=current_user.id,
    )
    db.add(movement)
    db.flush()

    return movement


def record_stock_out(
    db: Session, tenant: Tenant, current_user: User, item: Item, warehouse_id: int,
    quantity: float, reference_type: str = "sale",
    reference_number: Optional[str] = None, notes: Optional[str] = None,
    movement_date: Optional[date] = None,
) -> StockMovement:
    last = _last_movement(db, tenant.id, item.id, warehouse_id, for_update=True)
    old_qty = last.running_quantity if last else 0.0
    old_avg = last.running_average_cost if last else 0.0

    if quantity > old_qty:
        raise ValueError(f"Cannot issue {quantity} units - only {old_qty} on hand for {item.name} at this warehouse")

    new_qty = old_qty - quantity
    movement = StockMovement(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=warehouse_id,
        movement_type=reference_type, quantity=quantity, unit_cost=old_avg,
        running_quantity=new_qty, running_average_cost=old_avg,
        reference_type=reference_type, notes=notes, created_by=current_user.id,
    )
    db.add(movement)
    db.flush()

    return movement


def record_transfer(
    db: Session, tenant: Tenant, current_user: User, item: Item,
    from_warehouse_id: int, to_warehouse_id: int, quantity: float,
    notes: Optional[str] = None,
) -> tuple[StockMovement, StockMovement]:
    if from_warehouse_id == to_warehouse_id:
        raise ValueError("Source and destination warehouse must be different")

    last_from = _last_movement(db, tenant.id, item.id, from_warehouse_id, for_update=True)
    from_qty = last_from.running_quantity if last_from else 0.0
    from_avg = last_from.running_average_cost if last_from else 0.0

    if quantity > from_qty:
        raise ValueError(f"Cannot transfer {quantity} units - only {from_qty} on hand for {item.name} at source warehouse")

    out_movement = StockMovement(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=from_warehouse_id,
        movement_type="transfer_out", quantity=quantity, unit_cost=from_avg,
        running_quantity=from_qty - quantity, running_average_cost=from_avg,
        related_warehouse_id=to_warehouse_id, reference_type="transfer",
        notes=notes, created_by=current_user.id,
    )
    db.add(out_movement)
    db.flush()

    last_to = _last_movement(db, tenant.id, item.id, to_warehouse_id, for_update=True)
    to_qty = last_to.running_quantity if last_to else 0.0
    to_avg = last_to.running_average_cost if last_to else 0.0
    new_to_qty = to_qty + quantity
    new_to_avg = ((to_qty * to_avg) + (quantity * from_avg)) / new_to_qty if new_to_qty > 0 else 0.0

    in_movement = StockMovement(
        tenant_id=tenant.id, item_id=item.id, warehouse_id=to_warehouse_id,
        movement_type="transfer_in", quantity=quantity, unit_cost=from_avg,
        running_quantity=new_to_qty, running_average_cost=round(new_to_avg, 4),
        related_warehouse_id=from_warehouse_id, reference_type="transfer",
        notes=notes, created_by=current_user.id,
    )
    db.add(in_movement)
    db.flush()

    return out_movement, in_movement
