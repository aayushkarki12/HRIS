from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.employee import Employee
from ...models.resource import Resource
from ...models.project import Project
from ...models.assignment import Assignment
from ...schemas.assignment import AssignmentCreate, AssignmentUpdate, AssignmentResponse

router = APIRouter(prefix="/assignments", tags=["assignments"])

@router.get("/", response_model=List[AssignmentResponse])
def get_assignments(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    employee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all assignments for the current tenant.
    """
    query = db.query(Assignment).options(
        joinedload(Assignment.employee),
        joinedload(Assignment.resource),
        joinedload(Assignment.project)
    ).filter(Assignment.tenant_id == tenant.id)
    
    # If not admin, only show user's own assignments
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id,
            Employee.tenant_id == tenant.id
        ).first()
        if employee:
            query = query.filter(Assignment.employee_id == employee.id)
        else:
            return []
    
    if status:
        query = query.filter(Assignment.status == status)
    if employee_id:
        query = query.filter(Assignment.employee_id == employee_id)
    if project_id:
        query = query.filter(Assignment.project_id == project_id)
    
    assignments = query.offset(skip).limit(limit).all()
    
    # Manually construct response with nested objects
    result = []
    for assignment in assignments:
        result.append({
            "id": assignment.id,
            "employee_id": assignment.employee_id,
            "resource_id": assignment.resource_id,
            "project_id": assignment.project_id,
            "assigned_date": assignment.assigned_date,
            "return_date": assignment.return_date,
            "status": assignment.status,
            "created_at": assignment.created_at,
            "updated_at": assignment.updated_at,
            "employee": {
                "id": assignment.employee.id,
                "first_name": assignment.employee.first_name,
                "last_name": assignment.employee.last_name,
                "email": assignment.employee.email,
                "department": assignment.employee.department,
                "position": assignment.employee.position
            } if assignment.employee else None,
            "resource": {
                "id": assignment.resource.id,
                "name": assignment.resource.name,
                "type": assignment.resource.type,
                "serial_number": assignment.resource.serial_number,
                "status": assignment.resource.status
            } if assignment.resource else None,
            "project": {
                "id": assignment.project.id,
                "name": assignment.project.name,
                "status": assignment.project.status,
                "description": assignment.project.description
            } if assignment.project else None
        })
    
    return result

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get assignment by ID for the current tenant.
    """
    assignment = db.query(Assignment).options(
        joinedload(Assignment.employee),
        joinedload(Assignment.resource),
        joinedload(Assignment.project)
    ).filter(
        Assignment.id == assignment_id,
        Assignment.tenant_id == tenant.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(
            Employee.user_id == current_user.id,
            Employee.tenant_id == tenant.id
        ).first()
        if not employee or assignment.employee_id != employee.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this assignment"
            )
    
    return {
        "id": assignment.id,
        "employee_id": assignment.employee_id,
        "resource_id": assignment.resource_id,
        "project_id": assignment.project_id,
        "assigned_date": assignment.assigned_date,
        "return_date": assignment.return_date,
        "status": assignment.status,
        "created_at": assignment.created_at,
        "updated_at": assignment.updated_at,
        "employee": {
            "id": assignment.employee.id,
            "first_name": assignment.employee.first_name,
            "last_name": assignment.employee.last_name,
            "email": assignment.employee.email,
            "department": assignment.employee.department,
            "position": assignment.employee.position
        } if assignment.employee else None,
        "resource": {
            "id": assignment.resource.id,
            "name": assignment.resource.name,
            "type": assignment.resource.type,
            "serial_number": assignment.resource.serial_number,
            "status": assignment.resource.status
        } if assignment.resource else None,
        "project": {
            "id": assignment.project.id,
            "name": assignment.project.name,
            "status": assignment.project.status,
            "description": assignment.project.description
        } if assignment.project else None
    }

@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_data: AssignmentCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create a new assignment for the current tenant (admin only).
    """
    try:
        # Check if employee exists in this tenant
        employee = db.query(Employee).filter(
            Employee.id == assignment_data.employee_id,
            Employee.tenant_id == tenant.id
        ).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if resource exists and is available in this tenant
        resource = db.query(Resource).filter(
            Resource.id == assignment_data.resource_id,
            Resource.tenant_id == tenant.id
        ).first()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        if resource.status != "available":
            raise HTTPException(
                status_code=400,
                detail=f"Resource is not available (current status: {resource.status})"
            )
        
        # Check if project exists in this tenant
        project = db.query(Project).filter(
            Project.id == assignment_data.project_id,
            Project.tenant_id == tenant.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create assignment
        db_assignment = Assignment(
            employee_id=assignment_data.employee_id,
            resource_id=assignment_data.resource_id,
            project_id=assignment_data.project_id,
            assigned_date=assignment_data.assigned_date or date.today(),
            status="active",
            tenant_id=tenant.id
        )
        
        db.add(db_assignment)
        db.flush()
        
        # Update resource status
        resource.status = "assigned"
        resource.assigned_to = assignment_data.employee_id
        
        db.commit()
        db.refresh(db_assignment)
        
        # Reload with relationships
        db_assignment = db.query(Assignment).options(
            joinedload(Assignment.employee),
            joinedload(Assignment.resource),
            joinedload(Assignment.project)
        ).filter(
            Assignment.id == db_assignment.id,
            Assignment.tenant_id == tenant.id
        ).first()
        
        return {
            "id": db_assignment.id,
            "employee_id": db_assignment.employee_id,
            "resource_id": db_assignment.resource_id,
            "project_id": db_assignment.project_id,
            "assigned_date": db_assignment.assigned_date,
            "return_date": db_assignment.return_date,
            "status": db_assignment.status,
            "created_at": db_assignment.created_at,
            "updated_at": db_assignment.updated_at,
            "employee": {
                "id": db_assignment.employee.id,
                "first_name": db_assignment.employee.first_name,
                "last_name": db_assignment.employee.last_name,
                "email": db_assignment.employee.email,
                "department": db_assignment.employee.department,
                "position": db_assignment.employee.position
            } if db_assignment.employee else None,
            "resource": {
                "id": db_assignment.resource.id,
                "name": db_assignment.resource.name,
                "type": db_assignment.resource.type,
                "serial_number": db_assignment.resource.serial_number,
                "status": db_assignment.resource.status
            } if db_assignment.resource else None,
            "project": {
                "id": db_assignment.project.id,
                "name": db_assignment.project.name,
                "status": db_assignment.project.status,
                "description": db_assignment.project.description
            } if db_assignment.project else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Error creating assignment: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create assignment: {str(e)}"
        )

@router.put("/{assignment_id}/return")
def return_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Return a resource for the current tenant (admin only).
    """
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.tenant_id == tenant.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.status == "returned":
        raise HTTPException(status_code=400, detail="Assignment already returned")
    
    # Update assignment
    assignment.status = "returned"
    assignment.return_date = date.today()
    
    # Update resource status
    resource = db.query(Resource).filter(
        Resource.id == assignment.resource_id,
        Resource.tenant_id == tenant.id
    ).first()
    if resource:
        resource.status = "available"
        resource.assigned_to = None
    
    db.commit()
    
    return {
        "message": "Resource returned successfully",
        "assignment_id": assignment_id,
        "return_date": assignment.return_date
    }

@router.put("/{assignment_id}", response_model=AssignmentResponse)
def update_assignment(
    assignment_id: int,
    assignment_data: AssignmentUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update assignment for the current tenant (admin only).
    """
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.tenant_id == tenant.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    update_data = assignment_data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(assignment, key, value)
    
    db.commit()
    db.refresh(assignment)
    
    return assignment

@router.delete("/{assignment_id}")
def delete_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete assignment for the current tenant (admin only).
    """
    assignment = db.query(Assignment).filter(
        Assignment.id == assignment_id,
        Assignment.tenant_id == tenant.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # If assignment is active, return the resource first
    if assignment.status == "active":
        resource = db.query(Resource).filter(
            Resource.id == assignment.resource_id,
            Resource.tenant_id == tenant.id
        ).first()
        if resource:
            resource.status = "available"
            resource.assigned_to = None
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Assignment deleted successfully"}