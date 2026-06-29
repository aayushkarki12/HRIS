from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, date
from typing import Optional

from ...core.database import get_db
from ...core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from ...core.dependencies import get_current_active_user, get_current_tenant
from ...models.user import User
from ...models.employee import Employee
from ...models.tenant import Tenant
from ...schemas.user import UserCreate, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    """
    Register a new user with employee profile.
    """
    # Find or create tenant by subdomain
    tenant = db.query(Tenant).filter(Tenant.subdomain == user_data.tenant_subdomain).first()
    
    if not tenant:
        tenant = Tenant(
            name=user_data.tenant_subdomain.title(),
            subdomain=user_data.tenant_subdomain,
            email=user_data.email,
            is_active=True
        )
        db.add(tenant)
        db.flush()
        print(f"✅ Created new tenant: {user_data.tenant_subdomain}")
    
    # Check if user already exists
    existing_user = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email),
        User.tenant_id == tenant.id
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role="user",
        is_active=True,
        tenant_id=tenant.id
    )
    
    db.add(db_user)
    db.flush()
    
    # Generate employee ID
    employee_count = db.query(Employee).filter(Employee.tenant_id == tenant.id).count()
    employee_id = f"EMP{employee_count + 1:04d}"
    
    # Create employee profile
    db_employee = Employee(
        employee_id=employee_id,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        phone=user_data.phone or "",
        department=user_data.department,
        position=user_data.position,
        joining_date=user_data.join_date or date.today(),
        is_active=True,
        user_id=db_user.id,
        tenant_id=tenant.id
    )
    
    db.add(db_employee)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.get("/test-tenant")
def test_tenant(
    tenant: Tenant = Depends(get_current_tenant)
):
    """Test tenant endpoint."""
    return {
        "tenant_id": tenant.id,
        "tenant_name": tenant.name,
        "subdomain": tenant.subdomain,
        "is_active": tenant.is_active,
        "message": "Tenant is working!"
    }

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    Login endpoint using OAuth2 password flow.
    """
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )
    
    # Get tenant info
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role, "tenant_id": tenant.id},
        expires_delta=access_token_expires
    )
    
    # Return response with tenant as dict
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "email": tenant.email,
            "phone": tenant.phone,
            "address": tenant.address,
            "logo_url": tenant.logo_url,
            "is_active": tenant.is_active,
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at
        } if tenant else None
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user information.
    """
    return current_user