import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.attendance import WorkLocation
from ...schemas.work_location import WorkLocationCreate, WorkLocationUpdate, WorkLocationResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/work-locations", tags=["work-locations"])


@router.get("/", response_model=List[WorkLocationResponse])
def get_work_locations(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """List work locations for the current tenant (visible to all authenticated users)."""
    try:
        return db.query(WorkLocation).filter(
            WorkLocation.tenant_id == tenant.id
        ).order_by(WorkLocation.name).all()
    except Exception as e:
        logger.error(f"Error in get_work_locations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=WorkLocationResponse, status_code=status.HTTP_201_CREATED)
def create_work_location(
    data: WorkLocationCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Create a new work location, e.g. a warehouse (admin only)."""
    try:
        existing = db.query(WorkLocation).filter(
            WorkLocation.tenant_id == tenant.id,
            WorkLocation.name == data.name
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="A work location with this name already exists")

        db_location = WorkLocation(**data.model_dump(), tenant_id=tenant.id)
        db.add(db_location)
        db.commit()
        db.refresh(db_location)
        return db_location
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in create_work_location: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{location_id}", response_model=WorkLocationResponse)
def update_work_location(
    location_id: int,
    data: WorkLocationUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Update a work location (admin only)."""
    try:
        location = db.query(WorkLocation).filter(
            WorkLocation.id == location_id,
            WorkLocation.tenant_id == tenant.id
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Work location not found")

        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(location, key, value)

        db.commit()
        db.refresh(location)
        return location
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in update_work_location: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{location_id}")
def delete_work_location(
    location_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """Deactivate a work location (admin only)."""
    try:
        location = db.query(WorkLocation).filter(
            WorkLocation.id == location_id,
            WorkLocation.tenant_id == tenant.id
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Work location not found")

        location.is_active = False
        db.commit()
        return {"message": "Work location deactivated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error in delete_work_location: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
