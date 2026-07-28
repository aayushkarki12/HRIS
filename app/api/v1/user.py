from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional

from ...core.database import get_db
from ...core.dependencies import get_current_active_user
from ...core.permissions import require_permission, user_has_permission
from ...core.audit import record_audit_log
from ...models.user import User
from ...models.rbac import Role
from ...schemas.user import UserResponse, UserUpdate, ChangePasswordRequest, AdminResetPasswordRequest
from ...core.security import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])

MANAGE = require_permission("users.manage")


@router.get("/", response_model=List[UserResponse])
def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """
    Get all users in the caller's own tenant (admin/users.manage only).
    """
    query = db.query(User).filter(User.tenant_id == current_user.tenant_id)

    if search:
        query = query.filter(
            (User.username.contains(search)) |
            (User.email.contains(search)) |
            (User.first_name.contains(search)) |
            (User.last_name.contains(search))
        )

    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/me", response_model=UserResponse)
def get_current_user(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get current user information.
    """
    return current_user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get user by ID (admin/users.manage or self, same tenant only).
    """
    if current_user.id != user_id and not user_has_permission(db, current_user, "users.manage"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user"
        )

    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update user (admin/users.manage or self, same tenant only).
    """
    can_manage = user_has_permission(db, current_user, "users.manage")
    if current_user.id != user_id and not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this user"
        )

    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)

    # If role or role_id is being changed, the caller needs users.manage.
    if ('role' in update_data or 'role_id' in update_data) and not can_manage:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only someone with users.manage can update role"
        )

    if 'role_id' in update_data and update_data['role_id'] is not None:
        new_role = db.query(Role).filter(
            Role.id == update_data['role_id'], Role.tenant_id == current_user.tenant_id
        ).first()
        if not new_role:
            raise HTTPException(status_code=404, detail="Role not found")

    # Setting the legacy `role` string without also specifying role_id would
    # otherwise leave role_id stale - e.g. promoting someone to role="manager"
    # this way wouldn't grant the Manager system role's permissions on any
    # endpoint that's been migrated to the new system, silently reducing
    # their access. Keep them in sync unless the caller explicitly set
    # role_id itself (which takes precedence).
    if 'role' in update_data and 'role_id' not in update_data:
        system_role = db.query(Role).filter(
            Role.tenant_id == current_user.tenant_id,
            Role.is_system.is_(True),
            Role.name == {"admin": "Admin", "manager": "Manager", "user": "Employee"}.get(update_data['role']),
        ).first()
        if system_role:
            update_data['role_id'] = system_role.id

    # A manager must never be able to change their own role/role_id, even by
    # mistake - this would either lock them out of manage-gated endpoints or
    # (if they're the only one who can grant users.manage) leave nobody able
    # to promote anyone back.
    if current_user.id == user_id:
        if 'role' in update_data and update_data['role'] != current_user.role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change your own role. Ask another admin to do it."
            )
        if 'role_id' in update_data and update_data['role_id'] != current_user.role_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change your own role. Ask another admin to do it."
            )

    role_changed = 'role' in update_data and update_data['role'] != user.role
    role_id_changed = 'role_id' in update_data and update_data['role_id'] != user.role_id
    old_role = user.role

    for key, value in update_data.items():
        setattr(user, key, value)

    if role_changed:
        record_audit_log(db, user.tenant_id, current_user.id, "role_change", "user", user.id,
                          f"Role changed for {user.username}: {old_role} -> {user.role}",
                          request=request, severity="warning")
    if role_id_changed:
        record_audit_log(db, user.tenant_id, current_user.id, "role_change", "user", user.id,
                          f"RBAC role changed for {user.username} (role_id -> {user.role_id})",
                          request=request, severity="warning")

    db.commit()
    db.refresh(user)

    return user


@router.put("/{user_id}/change-password")
def change_password(
    user_id: int,
    data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change user password. Self-service only - even an admin cannot change
    another user's password this way (that would require knowing their
    current password, which nobody but the user themselves should know).
    """
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to change this user's password"
        )

    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Verify old password
    from ...core.security import verify_password, validate_password_strength
    if not verify_password(data.old_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )

    password_error = validate_password_strength(data.new_password)
    if password_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=password_error)

    # Update password and revoke all of this user's refresh tokens - a
    # deliberate password change should end every other active session,
    # otherwise a leaked/stolen session would survive the user's attempt
    # to secure their account.
    from ...models.refresh_token import RefreshToken
    user.hashed_password = get_password_hash(data.new_password)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    record_audit_log(db, user.tenant_id, current_user.id, "password_change", "user", user.id,
                      request=request, severity="warning")
    db.commit()

    return {"message": "Password changed successfully. All other sessions have been logged out."}


@router.put("/{user_id}/admin-reset-password")
def admin_reset_password(
    user_id: int,
    data: AdminResetPasswordRequest,
    request: Request,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """
    Admin-forced password reset, no knowledge of the old password required.
    For cases the self-service email flow can't cover - e.g. the user has
    lost access to their registered email entirely.
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    from ...core.security import validate_password_strength
    password_error = validate_password_strength(data.new_password)
    if password_error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=password_error)

    from ...models.refresh_token import RefreshToken
    user.hashed_password = get_password_hash(data.new_password)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})
    record_audit_log(db, user.tenant_id, current_user.id, "password_reset", "user", user.id,
                      f"Admin reset password for {user.username}", request=request, severity="warning")
    db.commit()

    return {"message": f"Password reset for {user.username}. All their active sessions have been logged out."}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """
    Delete user (admin/users.manage only, same tenant).
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    # Deactivate instead of hard delete
    user.is_active = False
    db.commit()

    return {"message": "User deactivated successfully"}


@router.patch("/{user_id}/activate")
def activate_user(
    user_id: int,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """
    Activate a user (admin/users.manage only, same tenant).
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_active = True
    db.commit()

    return {"message": "User activated successfully"}


@router.patch("/{user_id}/deactivate")
def deactivate_user(
    user_id: int,
    current_user: User = Depends(MANAGE),
    db: Session = Depends(get_db)
):
    """
    Deactivate a user (admin/users.manage only, same tenant).
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )

    user.is_active = False
    db.commit()

    return {"message": "User deactivated successfully"}
