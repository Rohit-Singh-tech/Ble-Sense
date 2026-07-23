from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TagRegistryBase(BaseModel):
    device_id: str
    name: str
    breed: Optional[str] = None
    location: Optional[str] = None
    weight: Optional[str] = None
    notes: Optional[str] = None

class TagRegistryCreate(TagRegistryBase):
    pass

class TagRegistryOut(TagRegistryBase):
    id: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
