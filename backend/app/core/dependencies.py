from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError
from typing import Optional

from .database import get_db
from .security import decode_access_token
from ..models.user import User
from ..models.tenant import Tenant
from ..models.employee import Employee

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_tenant(
    request: Request,
    db: Session = Depends(get_db)
) -> Tenant:
    """
    Get current tenant from subdomain or header.
    """
    # Method 1: From header (frontend sends this)
    tenant_id = request.headers.get("X-Tenant-ID")
    
    if tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == int(tenant_id)).first()
        if tenant:
            return tenant
    
    # Method 2: From subdomain
    host = request.headers.get("host", "")
    subdomain = host.split('.')[0] if '.' in host else None
    
    if subdomain and subdomain not in ["localhost", "api", "www", "127.0.0.1"]:
        tenant = db.query(Tenant).filter(Tenant.subdomain == subdomain).first()
        if tenant:
            return tenant
    
    # Method 3: Default tenant (for development)
    tenant = db.query(Tenant).filter(Tenant.subdomain == "default").first()
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant is inactive"
        )
    
    return tenant

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant)
) -> User:
    """Get current user from JWT token with tenant validation."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(
        User.id == int(user_id),
        User.tenant_id == tenant.id
    ).first()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

async def get_current_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get current admin user."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

async def get_current_manager_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get current manager or admin user."""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or admin privileges required"
        )
    return current_user

async def get_current_employee(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Employee:
    """Get current employee record."""
    employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee record not found"
        )
    return employee