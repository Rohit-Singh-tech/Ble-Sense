from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.registry import TagRegistry
from app.models.user import User
from app.schemas.registry import TagRegistryCreate, TagRegistryOut
from app.routers.deps import get_current_active_user, get_current_active_superuser

router = APIRouter(prefix="/registry", tags=["Tag Registry"])

@router.get("", response_model=List[TagRegistryOut])
def get_registry(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Fetch all registered device tag nodes.
    Accessible to all authenticated active users.
    """
    return db.query(TagRegistry).order_by(TagRegistry.device_id.asc()).all()

@router.post("", response_model=TagRegistryOut)
def add_or_update_registry(
    payload: TagRegistryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Register a new device tag or update an existing registration (Upsert).
    Only accessible to active system administrators (superusers).
    Tracks created_by and updated_by.
    """
    # Check if a registration with this device_id already exists
    existing = db.query(TagRegistry).filter(TagRegistry.device_id == payload.device_id).first()
    
    if existing:
        # Update existing
        existing.name = payload.name
        existing.breed = payload.breed
        existing.location = payload.location
        existing.weight = payload.weight
        existing.notes = payload.notes
        existing.updated_by = current_user.id
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        new_tag = TagRegistry(
            device_id=payload.device_id,
            name=payload.name,
            breed=payload.breed,
            location=payload.location,
            weight=payload.weight,
            notes=payload.notes,
            created_by=current_user.id,
            updated_by=current_user.id
        )
        db.add(new_tag)
        db.commit()
        db.refresh(new_tag)
        return new_tag

@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
def delete_registry_entry(
    device_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Unregister/delete a device tag registration by device_id.
    Only accessible to active system administrators (superusers).
    """
    entry = db.query(TagRegistry).filter(TagRegistry.device_id == device_id).first()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registry entry for Device ID {device_id} not found"
        )
    db.delete(entry)
    db.commit()
    return {"status": "success", "message": f"Successfully deleted Device ID {device_id} from registry"}
