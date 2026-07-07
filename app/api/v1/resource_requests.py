from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.tenant import Tenant
from ...models.resource import Resource
from ...models.resource_request import ResourceRequest
from ...models.employee import Employee
from ...models.assignment import Assignment
from ...schemas.resource import ResourceRequestCreate, ResourceRequestDecide, ResourceRequestResponse
from datetime import date

router = APIRouter(prefix="/resource-requests", tags=["resource-requests"])


@router.post("/", response_model=ResourceRequestResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("/", response_model=List[ResourceRequestResponse])
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


@router.put("/{request_id}/approve", response_model=ResourceRequestResponse)
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

        assignment = Assignment(
            employee_id=req.employee_id,
            resource_id=req.resource_id,
            assigned_date=date.today(),
            status="active",
            tenant_id=tenant.id,
        )
        db.add(assignment)

    req.status = "approved"
    req.admin_notes = decision.admin_notes

    record_audit_log(db, tenant.id, current_user.id, "approve", "resource_request", req.id,
                      f"Approved resource request for {resource.name if resource else 'resource'}")

    db.commit()
    db.refresh(req)
    return req


@router.put("/{request_id}/reject", response_model=ResourceRequestResponse)
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
