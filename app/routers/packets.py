from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Union, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import json
import os
from app.database import get_db
from app.models.packet import SensorPacket
from app.schemas.packet import PacketOut, PaginatedPackets
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint
from app.services.queue import packet_queue
from app.services.packet_processor import process_payload

router = APIRouter(prefix="/packets", tags=["Sensor Packets"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_sensor_packets(payload: Union[Dict[str, Any], List[Dict[str, Any]]], db: Session = Depends(get_db)):
    """
    Ingest BLE sensor packets synchronously.
    Saves payload raw format to raw_packets, decodes and saves headers and points immediately,
    and returns a summary of the ingested packets with their calculated device IDs and timestamps.
    """
    body = payload
    
    # 1. Create raw packet entry in processed status
    raw_packet = RawPacket(
        payload=body,
        status="processed",
        created_at=func.now(),
        processed_at=func.now()
    )
    db.add(raw_packet)
    db.flush() # Flush to get raw_packet.id

    try:
        processed_summary = process_payload(body, db, raw_packet_id=raw_packet.id)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insertion failed: {str(e)}"
        )

    return {
        "status": "success",
        "message": "Packets successfully ingested and processed synchronously",
        "raw_packet_id": raw_packet.id,
        "processed_packets": processed_summary
    }


@router.post("/save-json", status_code=status.HTTP_200_OK)
async def save_to_json_file(request: Request):
    """
    Ingest any JSON body and save it directly to saved_body.json.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload"
        )
        
    try:
        file_path = "saved_body.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(body, f, indent=4, ensure_ascii=False)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write to file: {str(e)}"
        )
        
    return {
        "status": "success",
        "message": "Payload saved to saved_body.json",
        "saved_path": os.path.abspath(file_path)
    }


@router.get("/devices", response_model=List[str])
def get_unique_device_ids(db: Session = Depends(get_db)):
    """
    Retrieve all unique Device IDs present in processed datalogger headers.
    """
    device_ids = db.query(DataLoggerHeader.device_id).distinct().order_by(DataLoggerHeader.device_id).all()
    return [d[0] for d in device_ids if d[0]]


@router.get("", response_model=PaginatedPackets)
def get_sensor_packets(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    app_id: Optional[str] = Query(None, alias="appId"),
    sensor_type: Optional[str] = Query(None, alias="type"),
    device_id: Optional[str] = Query(None, alias="deviceId"),
    start_time: Optional[datetime] = Query(None, alias="startTime"),
    end_time: Optional[datetime] = Query(None, alias="endTime"),
    search: Optional[str] = Query(None),
    sort_field: str = Query("timestamp", alias="sortField"),
    sort_order: str = Query("desc", alias="sortOrder"),
    db: Session = Depends(get_db)
):
    """
    Fetch sensor packets with pagination, filtering, and sorting.
    """
    query = db.query(SensorPacket)
    
    # 1. Filter by App ID
    if app_id and app_id != 'All':
        query = query.filter(SensorPacket.app_id == app_id)
        
    # 2. Filter by Sensor Type (specifically 'DataLogger')
    if sensor_type == 'DataLogger':
        query = query.filter(
            (SensorPacket.data['type'].as_string() == 'DataLogger') |
            (SensorPacket.data['data']['type'].as_string() == 'DataLogger') |
            (SensorPacket.data['deviceId'].is_not(None)) |
            (SensorPacket.data['data']['deviceId'].is_not(None))
        )
        
    # 3. Filter by specific Device ID
    if device_id and device_id != 'All':
        query = query.filter(
            (SensorPacket.data['deviceId'].as_string() == device_id) |
            (SensorPacket.data['data']['deviceId'].as_string() == device_id)
        )
        
    # 4. Filter by Date-Time Range
    if start_time:
        query = query.filter(SensorPacket.timestamp >= start_time)
    if end_time:
        query = query.filter(SensorPacket.timestamp <= end_time)
        
    # 5. Search filter (App ID or Device ID)
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (func.lower(SensorPacket.app_id).like(search_term)) |
            (func.lower(SensorPacket.data['deviceId'].as_string()).like(search_term)) |
            (func.lower(SensorPacket.data['data']['deviceId'].as_string()).like(search_term))
        )
        
    # 6. Sorting
    if sort_field == 'timestamp':
        order_col = SensorPacket.timestamp
    elif sort_field == 'deviceId':
        order_col = func.coalesce(
            SensorPacket.data['deviceId'].as_string(),
            SensorPacket.data['data']['deviceId'].as_string(),
            SensorPacket.app_id
        )
    elif sort_field == 'type':
        order_col = func.coalesce(
            SensorPacket.data['type'].as_string(),
            SensorPacket.data['data']['type'].as_string(),
            SensorPacket.app_id
        )
    else:
        order_col = SensorPacket.timestamp
        
    if sort_order == 'asc':
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())
        
    total = query.count()
    skip = (page - 1) * limit
    packets = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "records": [
            PacketOut(
                id=p.id,
                appId=p.app_id,
                data=p.data,
                timestamp=p.timestamp
            ) for p in packets
        ]
    }


@router.post("/cleanup-future-packets")
def cleanup_future_packets(db: Session = Depends(get_db)):
    """
    Utility endpoint to delete any historical records that were accidentally created
    with future timestamps due to the previous '+8 seconds' cascading bug.
    """
    now = datetime.now(timezone.utc)
    del_sensors = db.query(SensorPacket).filter(SensorPacket.timestamp > now).delete(synchronize_session=False)
    del_headers = db.query(DataLoggerHeader).filter(DataLoggerHeader.timestamp > now).delete(synchronize_session=False)
    db.commit()
    return {
        "status": "success",
        "deleted_future_sensor_packets": del_sensors,
        "deleted_future_datalogger_headers": del_headers
    }