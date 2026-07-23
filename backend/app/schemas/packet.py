from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional, List

class PacketCreate(BaseModel):
    data: Any
    timestamp: Optional[datetime] = None

class PacketOut(BaseModel):
    id: int
    appId: str
    data: Any
    timestamp: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PaginatedPackets(BaseModel):
    total: int
    records: List[PacketOut]
