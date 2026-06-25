from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user
from ...models.user import User
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
    status: Optional[str] = Query(None, description="Filter by status (active, returned, overdue)"),
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all assignments with optional filters.
    """
    query = db.query(Assignment).options(
        joinedload(Assignment.employee),
        joinedload(Assignment.resource),
        joinedload(Assignment.project)
    )
    
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
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
    return assignments

@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get assignment by ID."""
    assignment = db.query(Assignment).options(
        joinedload(Assignment.employee),
        joinedload(Assignment.resource),
        joinedload(Assignment.project)
    ).filter(Assignment.id == assignment_id).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if current_user.role not in ["admin", "manager"]:
        employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not employee or assignment.employee_id != employee.id:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this assignment"
            )
    
    return assignment

@router.post("/", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def create_assignment(
    assignment_data: AssignmentCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create a new assignment (admin only).
    """
    try:
        employee = db.query(Employee).filter(Employee.id == assignment_data.employee_id).first()
        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        resource = db.query(Resource).filter(Resource.id == assignment_data.resource_id).first()
        if not resource:
            raise HTTPException(status_code=404, detail="Resource not found")
        
        if resource.status != "available":
            raise HTTPException(
                status_code=400,
                detail=f"Resource is not available (current status: {resource.status})"
            )
        
        project = db.query(Project).filter(Project.id == assignment_data.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        db_assignment = Assignment(
            employee_id=assignment_data.employee_id,
            resource_id=assignment_data.resource_id,
            project_id=assignment_data.project_id,
            assigned_date=assignment_data.assigned_date or date.today(),
            status="active"
        )
        
        db.add(db_assignment)
        db.flush()
        
        resource.status = "assigned"
        
        db.commit()
        db.refresh(db_assignment)
        
        db_assignment = db.query(Assignment).options(
            joinedload(Assignment.employee),
            joinedload(Assignment.resource),
            joinedload(Assignment.project)
        ).filter(Assignment.id == db_assignment.id).first()
        
        return db_assignment
        
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
    db: Session = Depends(get_db)
):
    """
    Return a resource (admin only).
    """
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.status == "returned":
        raise HTTPException(status_code=400, detail="Assignment already returned")
    
    assignment.status = "returned"
    assignment.return_date = date.today()
    
    resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
    if resource:
        resource.status = "available"
    
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
    db: Session = Depends(get_db)
):
    """Update assignment (admin only)."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
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
    db: Session = Depends(get_db)
):
    """Delete assignment (admin only)."""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment.status == "active":
        resource = db.query(Resource).filter(Resource.id == assignment.resource_id).first()
        if resource:
            resource.status = "available"
    
    db.delete(assignment)
    db.commit()
    
    return {"message": "Assignment deleted successfully"}