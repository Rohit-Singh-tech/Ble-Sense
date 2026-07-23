from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, ChangePasswordRequest
from app.security import get_password_hash, verify_password
from app.routers.deps import get_current_active_user, get_current_active_superuser

router = APIRouter(prefix="/users", tags=["Users & Management"])

@router.get("/me", response_model=UserOut)
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user)
):
    """Retrieve the current authenticated user's profile details."""
    return current_user


@router.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Change the logged-in user's password."""
    # Verify current password
    if not verify_password(request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )
    
    # Hash and save new password
    current_user.hashed_password = get_password_hash(request.new_password)
    db.commit()
    
    return {"message": "Password changed successfully."}


@router.get("/", response_model=List[UserOut])
def get_all_users(
    current_user: User = Depends(get_current_active_superuser),
    db: Session = Depends(get_db)
):
    """List all registered users in the system (Admin only)."""
    users = db.query(User).all()
    return users


@router.post("/{user_id}/promote")
def promote_user_to_admin(
    user_id: int,
    current_user: User = Depends(get_current_active_superuser),
    db: Session = Depends(get_db)
):
    """Promote a specific user to administrator privileges (Admin only)."""
    # Prevent promoting oneself (unnecessary action)
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already an administrator."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    user.is_superuser = True
    # If not active or verified, promote also activates/verifies them to prevent lockouts
    user.is_active = True
    user.is_verified = True
    db.commit()
    
    return {"message": f"User '{user.username}' has been promoted to administrator."}


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_superuser),
    db: Session = Depends(get_db)
):
    """Delete a user account by ID (Admin only)."""
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own administrator account."
        )
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )
        
    db.delete(user)
    db.commit()
    
    return {"message": f"User '{user.username}' has been deleted successfully."}
