from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional, List

class RawPacketMinOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RawPacketOut(BaseModel):
    id: int
    payload: Any
    status: str
    created_at: datetime
    processed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DataLoggerPointOut(BaseModel):
    point_index: int
    x: Optional[int] = None
    y: Optional[int] = None
    z: Optional[int] = None

    class Config:
        from_attributes = True


class DataLoggerHeaderOut(BaseModel):
    id: int
    raw_packet_id: Optional[int] = None
    app_id: str
    device_id: str
    packet_id_num: int
    total_packets: int
    raw_data: Optional[str] = None
    timestamp: datetime
    created_at: datetime
    points: Optional[List[DataLoggerPointOut]] = None
    raw_packet: Optional[RawPacketMinOut] = None

    class Config:
        from_attributes = True


class PaginatedRawPackets(BaseModel):
    total: int
    records: List[RawPacketOut]


class PaginatedDataLoggerHeaders(BaseModel):
    total: int
    records: List[DataLoggerHeaderOut]
