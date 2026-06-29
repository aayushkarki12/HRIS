from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...schemas.tenant import TenantCreate, TenantUpdate, TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])

@router.get("/", response_model=List[TenantResponse])
def get_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all tenants (admin only)."""
    tenants = db.query(Tenant).offset(skip).limit(limit).all()
    return tenants

@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get tenant by ID (admin only)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_data: TenantCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new tenant (admin only)."""
    # Check if subdomain already exists
    existing = db.query(Tenant).filter(Tenant.subdomain == tenant_data.subdomain).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Subdomain already exists"
        )
    
    db_tenant = Tenant(**tenant_data.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    tenant_data: TenantUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Update tenant (admin only)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = tenant_data.model_dump(exclude_unset=True)
    
    if 'subdomain' in update_data:
        existing = db.query(Tenant).filter(
            Tenant.subdomain == update_data['subdomain'],
            Tenant.id != tenant_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Subdomain already exists"
            )
    
    for key, value in update_data.items():
        setattr(tenant, key, value)
    
    db.commit()
    db.refresh(tenant)
    return tenant

@router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete tenant (admin only)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    db.delete(tenant)
    db.commit()
    return {"message": "Tenant deleted successfully"}