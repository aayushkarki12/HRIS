from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.resource import Resource
from ...schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse

router = APIRouter(prefix="/resources", tags=["resources"])

@router.get("/", response_model=List[ResourceResponse])
def get_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all resources for the current tenant.
    """
    query = db.query(Resource).filter(Resource.tenant_id == tenant.id)
    
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
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all available resources for the current tenant.
    """
    resources = db.query(Resource).filter(
        Resource.status == "available",
        Resource.tenant_id == tenant.id
    ).all()
    return resources

@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get resource by ID for the current tenant.
    """
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id
    ).first()
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource_data: ResourceCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create a new resource for the current tenant (admin only).
    """
    # Check if serial number already exists in this tenant
    existing = db.query(Resource).filter(
        Resource.serial_number == resource_data.serial_number,
        Resource.tenant_id == tenant.id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serial number already exists"
        )
    
    db_resource = Resource(**resource_data.model_dump(), tenant_id=tenant.id)
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource

@router.put("/{resource_id}", response_model=ResourceResponse)
def update_resource(
    resource_id: int,
    resource_data: ResourceUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update resource for the current tenant (admin only).
    """
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id
    ).first()
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    for key, value in resource_data.model_dump(exclude_unset=True).items():
        setattr(resource, key, value)
    
    db.commit()
    db.refresh(resource)
    return resource

@router.delete("/{resource_id}")
def delete_resource(
    resource_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete resource for the current tenant (admin only).
    """
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id
    ).first()
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if resource.status == "assigned":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete resource that is currently assigned"
        )
    
    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully"}