from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ...core.database import get_db
from ...core.dependencies import get_current_active_user
from ...core.permissions import require_permission
from ...models.user import User
from ...models.tenant import Tenant
from ...schemas.tenant import TenantCreate, TenantUpdate, TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])

MANAGE = require_permission("tenant.manage")

# There is no platform-level "superadmin" role in this system - "admin" is a
# per-tenant role held by ordinary customers. Every route below must
# therefore only ever expose or mutate the caller's OWN tenant record; none
# of these should ever take an arbitrary tenant_id from another tenant.

@router.get("", response_model=List[TenantResponse])
def get_tenants(
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """List tenants visible to the caller - just their own."""
    tenants = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).all()
    return tenants

@router.get("/me", response_model=TenantResponse)
def get_my_tenant(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get the current user's own tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """Get tenant by ID - admin of that same tenant only."""
    if tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this tenant")
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    tenant_data: TenantUpdate,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """Update tenant - admin of that same tenant only."""
    if tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this tenant")

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
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """Delete tenant - admin of that same tenant only."""
    if tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this tenant")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    db.delete(tenant)
    db.commit()
    return {"message": "Tenant deleted successfully"}
