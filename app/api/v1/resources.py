from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.resource import Resource
from ...models.resource_request import ResourceRequest
from ...models.employee import Employee
from ...schemas.resource import ResourceCreate, ResourceUpdate, ResourceResponse, ResourceRequestCreate, ResourceRequestDecide, ResourceRequestResponse

router = APIRouter(prefix="/resources", tags=["resources"])


# ─── Collection + search ──────────────────────────────────────────────────────

@router.get("/", response_model=List[ResourceResponse])
def get_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
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
    return query.offset(skip).limit(limit).all()


@router.get("/available", response_model=List[ResourceResponse])
def get_available_resources(
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    return db.query(Resource).filter(
        Resource.status == "available",
        Resource.tenant_id == tenant.id,
    ).all()


# ─── Resource Requests (MUST be before /{resource_id}) ───────────────────────

@router.post("/requests", response_model=ResourceRequestResponse, status_code=status.HTTP_201_CREATED)
def create_resource_request(
    request_data: ResourceRequestCreate,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(
        Resource.id == request_data.resource_id,
        Resource.tenant_id == tenant.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    if resource.status != "available":
        raise HTTPException(status_code=400, detail="Resource is not available for requests")

    employee = db.query(Employee).filter(
        Employee.user_id == current_user.id,
        Employee.tenant_id == tenant.id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")

    existing = db.query(ResourceRequest).filter(
        ResourceRequest.resource_id == request_data.resource_id,
        ResourceRequest.employee_id == employee.id,
        ResourceRequest.status == "pending",
        ResourceRequest.tenant_id == tenant.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending request for this resource")

    req = ResourceRequest(
        resource_id=request_data.resource_id,
        employee_id=employee.id,
        reason=request_data.reason,
        status="pending",
        tenant_id=tenant.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/requests", response_model=List[ResourceRequestResponse])
def get_resource_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    if current_user.role == "admin":
        query = db.query(ResourceRequest).filter(ResourceRequest.tenant_id == tenant.id)
    else:
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id,
            Employee.tenant_id == tenant.id,
        ).first()
        if not employee:
            return []
        query = db.query(ResourceRequest).filter(
            ResourceRequest.employee_id == employee.id,
            ResourceRequest.tenant_id == tenant.id,
        )
    if status_filter:
        query = query.filter(ResourceRequest.status == status_filter)
    return query.order_by(ResourceRequest.created_at.desc()).all()


@router.put("/requests/{request_id}/approve", response_model=ResourceRequestResponse)
def approve_resource_request(
    request_id: int,
    decision: ResourceRequestDecide,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    req = db.query(ResourceRequest).filter(
        ResourceRequest.id == request_id,
        ResourceRequest.tenant_id == tenant.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    resource = db.query(Resource).filter(Resource.id == req.resource_id).first()
    if resource and resource.status == "available":
        resource.status = "assigned"
        resource.assigned_to = req.employee_id

    req.status = "approved"
    req.admin_notes = decision.admin_notes
    db.commit()
    db.refresh(req)
    return req


@router.put("/requests/{request_id}/reject", response_model=ResourceRequestResponse)
def reject_resource_request(
    request_id: int,
    decision: ResourceRequestDecide,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    req = db.query(ResourceRequest).filter(
        ResourceRequest.id == request_id,
        ResourceRequest.tenant_id == tenant.id,
    ).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    req.status = "rejected"
    req.admin_notes = decision.admin_notes
    db.commit()
    db.refresh(req)
    return req


# ─── Single resource (parametric — must be LAST) ─────────────────────────────

@router.get("/{resource_id}", response_model=ResourceResponse)
def get_resource(
    resource_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.post("/", response_model=ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource_data: ResourceCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db),
):
    existing = db.query(Resource).filter(
        Resource.serial_number == resource_data.serial_number,
        Resource.tenant_id == tenant.id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Serial number already exists")

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
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id,
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
    db: Session = Depends(get_db),
):
    resource = db.query(Resource).filter(
        Resource.id == resource_id,
        Resource.tenant_id == tenant.id,
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    if resource.status == "assigned":
        raise HTTPException(status_code=400, detail="Cannot delete resource that is currently assigned")

    db.delete(resource)
    db.commit()
    return {"message": "Resource deleted successfully"}
