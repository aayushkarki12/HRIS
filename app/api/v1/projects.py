from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_admin_user, get_current_tenant
from ...models.user import User
from ...models.tenant import Tenant
from ...models.project import Project
from ...schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

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