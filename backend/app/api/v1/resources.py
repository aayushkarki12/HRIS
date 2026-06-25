from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user
from ...models.user import User
from ...models.resource import Resource
from ...schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse

router = APIRouter(prefix="/resources", tags=["resources"])

@router.get("/", response_model=List[ResourceResponse])
def get_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by status (available, assigned, maintenance, repair)"),
    type: Optional[str] = Query(None, description="Filter by type (laptop, monitor, keyboard, mouse, other)"),
    search: Optional[str] = Query(None, description="Search by name, serial number, or asset tag"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all resources with optional filters.
    """
    query = db.query(Resource)
    
    if status:
        query = query.filter(Resource.status == status)
    if type:
        query = query.filter(Resource.type == type)
    if search:
        query = query.filter(
            (Resource.name.contains(search)) |
            (Resource.serial_number.contains(search)) |
            (Resource.asset_tag.contains(search))
        )
    
    resources = query.offset(skip).limit(limit).all()
    return resources

@router.get("/available", response_model=List[ResourceResponse])
def get_available_resources(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all available resources."""
    resources = db.query(Resource).filter(Resource.status == "available").all()
    return resources

@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get resource by ID."""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource_data: ResourceCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new resource (admin only).
    """
    try:
        # Check if serial number already exists
        existing = db.query(Resource).filter(
            Resource.serial_number == resource_data.serial_number
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Serial number already exists"
            )
        
        # Create resource
        db_resource = Resource(**resource_data.model_dump())
        db.add(db_resource)
        db.commit()
        db.refresh(db_resource)
        return db_resource
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating resource: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create resource: {str(e)}"
        )

@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    resource_data: ResourceUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update resource (admin only).
    """
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    update_data = resource_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(resource, key, value)
    
    db.commit()
    db.refresh(resource)
    return resource

@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Delete resource (admin only).
    """
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Check if resource is assigned
    if resource.status == "assigned":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete resource that is currently assigned"
        )
    
    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully"}

@router.patch("/{resource_id}/status")
def update_resource_status(
    resource_id: int,
    status: str = Query(..., description="New status (available, assigned, maintenance, repair)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update only the resource status (admin only).
    """
    valid_statuses = ["available", "assigned", "maintenance", "repair"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    resource.status = status
    db.commit()
    
    return {"message": f"Resource status updated to '{status}'", "resource_id": resource_id}