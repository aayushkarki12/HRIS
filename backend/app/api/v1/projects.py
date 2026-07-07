from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.project import Project
from ...models.employee import Employee
from ...models.project_member import ProjectMember
from ...schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectMemberCreate, ProjectMemberResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all projects for the current tenant.
    """
    query = db.query(Project).filter(Project.tenant_id == tenant.id)
    
    if status:
        query = query.filter(Project.status == status)
    if search:
        query = query.filter(
            (Project.name.contains(search)) |
            (Project.description.contains(search))
        )
    
    projects = query.offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get project by ID for the current tenant.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Create a new project for the current tenant (admin only).
    """
    db_project = Project(**project_data.model_dump(), tenant_id=tenant.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update project for the current tenant (admin only).
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    for key, value in project_data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Delete project for the current tenant (admin only).
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
def get_project_members(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Get all team members for a project.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.tenant_id == tenant.id
    ).all()


@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: int,
    member_data: ProjectMemberCreate,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Add an employee to a project's team (admin only). An employee can belong
    to multiple projects at once - membership here is independent of any
    resource assignment.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    employee = db.query(Employee).filter(
        Employee.id == member_data.employee_id,
        Employee.tenant_id == tenant.id
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.employee_id == member_data.employee_id,
        ProjectMember.tenant_id == tenant.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Employee is already a member of this project")

    member = ProjectMember(
        project_id=project_id,
        employee_id=member_data.employee_id,
        role=member_data.role,
        tenant_id=tenant.id
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    member = db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(ProjectMember.id == member.id).first()
    return member


@router.delete("/{project_id}/members/{employee_id}")
def remove_project_member(
    project_id: int,
    employee_id: int,
    current_user: User = Depends(get_current_admin_user),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Remove an employee from a project's team (admin only).
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.employee_id == employee_id,
        ProjectMember.tenant_id == tenant.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="This employee is not a member of the project")

    db.delete(member)
    db.commit()
    return {"message": "Employee removed from project"}