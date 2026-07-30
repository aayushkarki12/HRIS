from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user, get_current_tenant
from ...core.permissions import require_permission, user_has_permission
from ...models.user import User
from ...models.tenant import Tenant
from ...models.project import Project
from ...models.employee import Employee
from ...models.project_member import ProjectMember
from ...models.assignment import Assignment
from ...models.assignment_project import AssignmentProject
from ...models.invoice import Invoice
from ...models.timesheet import TimesheetEntry
from ...schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    ProjectMemberCreate, ProjectMemberUpdate, ProjectMemberResponse,
)

router = APIRouter(prefix="/projects", tags=["projects"])

MANAGE = require_permission("projects.manage")

# The hierarchy graph on the project detail page needs exactly one "lead" to
# put at the top - reusing the free-text `role` column (rather than adding a
# dedicated is_lead flag) so existing role values like "QA"/"Developer" keep
# working. This exact string is what the frontend's "Make Lead" action writes
# and what it matches on to find the lead; anything else is just a member.
LEAD_ROLE = "Lead"


def _can_view_all_projects(db: Session, user: User) -> bool:
    return user.role in ("admin", "manager") or user_has_permission(db, user, "projects.manage")


def _member_employee(db: Session, tenant_id: int, user: User) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.user_id == user.id, Employee.tenant_id == tenant_id).first()


def _is_project_member(db: Session, tenant_id: int, project_id: int, user: User) -> bool:
    employee = _member_employee(db, tenant_id, user)
    if not employee:
        return False
    return db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.employee_id == employee.id,
        ProjectMember.tenant_id == tenant_id,
    ).first() is not None


@router.get("", response_model=List[ProjectResponse])
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
    Get projects for the current tenant. Admin/manager/projects.manage see
    every project; everyone else only sees projects they're a member of
    (ProjectMember), not the tenant's full project list.
    """
    query = db.query(Project).filter(Project.tenant_id == tenant.id)

    if not _can_view_all_projects(db, current_user):
        employee = _member_employee(db, tenant.id, current_user)
        if not employee:
            return []
        query = query.join(ProjectMember, ProjectMember.project_id == Project.id).filter(
            ProjectMember.employee_id == employee.id,
            ProjectMember.tenant_id == tenant.id,
        )

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
    Get project by ID for the current tenant. Same visibility rule as the
    list endpoint - a non-member without projects.manage/admin/manager can't
    reach a project's details just by guessing its id.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not _can_view_all_projects(db, current_user) and not _is_project_member(db, tenant.id, project_id, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this project")

    return project

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(MANAGE),
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
    current_user: User = Depends(MANAGE),
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
    current_user: User = Depends(MANAGE),
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

    # Detach everything that references this project first so the delete
    # always succeeds — the referencing rows (assignments, invoices,
    # timesheet entries) are kept, only their tie to this project is removed.
    db.query(AssignmentProject).filter(AssignmentProject.project_id == project_id).delete()
    db.query(Assignment).filter(Assignment.project_id == project_id).update({"project_id": None})
    db.query(Invoice).filter(Invoice.project_id == project_id).update({"project_id": None})
    db.query(TimesheetEntry).filter(TimesheetEntry.project_id == project_id).update({"project_id": None})

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
    Get all team members for a project. Same visibility rule as GET /{project_id}.
    """
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.tenant_id == tenant.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not _can_view_all_projects(db, current_user) and not _is_project_member(db, tenant.id, project_id, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this project")

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
    current_user: User = Depends(MANAGE),
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


@router.put("/{project_id}/members/{employee_id}", response_model=ProjectMemberResponse)
def update_project_member(
    project_id: int,
    employee_id: int,
    member_data: ProjectMemberUpdate,
    current_user: User = Depends(MANAGE),
    tenant: Tenant = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    """
    Update a project member's role (admin only). Setting role to exactly
    "Lead" demotes any other current lead on this project first, so there's
    at most one - the frontend's hierarchy graph assumes a single lead node.
    """
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.employee_id == employee_id,
        ProjectMember.tenant_id == tenant.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="This employee is not a member of the project")

    if member_data.role == LEAD_ROLE:
        db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.tenant_id == tenant.id,
            ProjectMember.role == LEAD_ROLE,
            ProjectMember.id != member.id,
        ).update({"role": None})

    member.role = member_data.role
    db.commit()

    member = db.query(ProjectMember).options(
        joinedload(ProjectMember.employee)
    ).filter(ProjectMember.id == member.id).first()
    return member


@router.delete("/{project_id}/members/{employee_id}")
def remove_project_member(
    project_id: int,
    employee_id: int,
    current_user: User = Depends(MANAGE),
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