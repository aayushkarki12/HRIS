import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, date, datetime, timezone
from typing import Optional

from ...core.database import get_db
from ...core.config import settings
from ...core.security import (
    create_access_token,
    verify_password,
    get_password_hash,
    generate_refresh_token,
    hash_refresh_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)
from ...core.dependencies import get_current_active_user, get_current_tenant
from ...core.limiter import limiter
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.employee import Employee
from ...models.tenant import Tenant
from ...models.refresh_token import RefreshToken
from ...models.password_reset_token import PasswordResetToken
from ...schemas.user import (
    UserCreate, UserResponse, Token,
    RefreshTokenRequest, AccessTokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from ...core.security import validate_password_strength
from ...core.email import send_password_reset_email

PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = 60

logger = logging.getLogger(__name__)


def _issue_refresh_token(db: Session, user: User, tenant_id: int) -> str:
    """Create and persist a new refresh token, returning the raw (unhashed) value."""
    raw_token = generate_refresh_token()
    db_token = RefreshToken(
        user_id=user.id,
        tenant_id=tenant_id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        revoked=False,
    )
    db.add(db_token)
    return raw_token

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(
    request: Request,
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
        logger.info(f"✅ Created new tenant: {user_data.tenant_subdomain}")
    
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
@limiter.limit("10/minute")
def login(
    request: Request,
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
        record_audit_log(db, user.tenant_id, user.id, "login_failed", "auth", user.id,
                          "Incorrect password", request=request, severity="warning")
        db.commit()
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

    refresh_token = _issue_refresh_token(db, user, tenant.id)
    record_audit_log(db, tenant.id, user.id, "login", "auth", user.id, request=request)
    db.commit()

    # Return response with tenant as dict
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
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
            "office_latitude": tenant.office_latitude,
            "office_longitude": tenant.office_longitude,
            "office_radius": tenant.office_radius,
            "office_address": tenant.office_address,
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


@router.post("/refresh", response_model=AccessTokenResponse)
@limiter.limit("30/minute")
def refresh_access_token(
    request: Request,
    data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Exchange a valid refresh token for a new access token. Rotates the
    refresh token on every use (old one revoked, new one issued) so a stolen
    refresh token can only be replayed once before the legitimate client's
    next refresh fails and the theft becomes visible.
    """
    token_hash = hash_refresh_token(data.refresh_token)
    db_token = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash
    ).first()

    if not db_token or db_token.revoked or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    # Rotate: revoke the used token, issue a new one
    db_token.revoked = True
    new_refresh_token = _issue_refresh_token(db, user, db_token.tenant_id)

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role, "tenant_id": db_token.tenant_id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Revoke a refresh token, ending that session. The still-live access token
    (if any) remains valid until its short expiry runs out - this is the
    standard tradeoff of stateless JWTs and is why access tokens are kept short.
    """
    token_hash = hash_refresh_token(data.refresh_token)
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if db_token:
        db_token.revoked = True
        record_audit_log(db, db_token.tenant_id, db_token.user_id, "logout", "auth", db_token.user_id, request=request)
        db.commit()
    return None


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Request a password reset email. Always returns the same generic message
    regardless of whether the email/tenant exists or the send succeeded -
    leaking that information would let an attacker enumerate valid accounts.
    """
    generic_response = {"message": "If an account with that email exists, a password reset link has been sent."}

    tenant = db.query(Tenant).filter(Tenant.subdomain == data.tenant_subdomain).first()
    if not tenant:
        return generic_response

    user = db.query(User).filter(User.email == data.email, User.tenant_id == tenant.id).first()
    if not user or not user.is_active:
        return generic_response

    raw_token = generate_refresh_token()
    db.add(PasswordResetToken(
        user_id=user.id,
        tenant_id=tenant.id,
        token_hash=hash_refresh_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
        used=False,
    ))
    db.commit()

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    send_password_reset_email(user.email, user.first_name, reset_link)

    return generic_response


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Redeem a password reset token: validate it's unused and unexpired, set
    the new password, mark the token used, and revoke all refresh tokens
    (same reasoning as a self-service password change).
    """
    token_hash = hash_refresh_token(data.token)
    db_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash
    ).first()

    if not db_token or db_token.used or db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one."
        )

    password_error = validate_password_strength(data.new_password)
    if password_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=password_error)

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.hashed_password = get_password_hash(data.new_password)
    db_token.used = True
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    db.commit()

    return {"message": "Password has been reset successfully. Please log in with your new password."}