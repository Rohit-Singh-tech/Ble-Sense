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

    packets_list = body if isinstance(body, list) else [body]
    processed_summary = []

    try:
        for pkt in packets_list:
            if not isinstance(pkt, dict):
                continue
                
            # Resolve base timestamp of the packet / request
            timestamp_raw = pkt.get("timestamp")
            if not timestamp_raw and "data" in pkt:
                data_root = pkt["data"]
                if isinstance(data_root, dict):
                    timestamp_raw = data_root.get("timestamp")
            
            base_timestamp = datetime.now(timezone.utc)
            if timestamp_raw:
                try:
                    if isinstance(timestamp_raw, (int, float)):
                        base_timestamp = datetime.fromtimestamp(timestamp_raw / 1000.0, tz=timezone.utc)
                    else:
                        base_timestamp = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
                except Exception:
                    base_timestamp = datetime.now(timezone.utc)

            # Extract inner data wrapper
            data_wrapper = pkt.get("data", pkt)
            inner_data = data_wrapper.get("data", data_wrapper) if isinstance(data_wrapper, dict) else {}
            
            if not isinstance(inner_data, dict):
                inner_data = pkt
                data_wrapper = pkt

            app_id = inner_data.get("appId", "Unknown")
            raw_data = inner_data.get("rawData", "")
            sensor_type = inner_data.get("type", "Unknown")

            # Standardize and split hex data tokens
            hex_tokens = []
            if isinstance(raw_data, str) and raw_data.strip():
                cleaned_hex = "".join(c for c in raw_data if c.isalnum())
                if len(cleaned_hex) % 2 == 0 and len(cleaned_hex) >= 492:
                    hex_tokens = [cleaned_hex[idx:idx+2] for idx in range(0, len(cleaned_hex), 2)]
                else:
                    hex_tokens = raw_data.strip().split()

            # Extract 246-byte sub-packets
            sub_packets = []
            if len(hex_tokens) >= 246:
                for chunk_idx in range(0, len(hex_tokens), 246):
                    chunk = hex_tokens[chunk_idx:chunk_idx+246]
                    if len(chunk) == 246 and chunk[-1].upper() == "FE":
                        sub_packets.append(chunk)

            # Case 1: Ingesting a raw hex stream containing one or more packets
            if sub_packets:
                N = len(sub_packets)
                for k, chunk in enumerate(sub_packets):
                    # Device ID (byte 0) -> decimal string
                    dev_id = str(int(chunk[0], 16))

                    # Query database for the last header of the same Device ID
                    last_header = db.query(DataLoggerHeader).filter(
                        DataLoggerHeader.device_id == dev_id
                    ).order_by(DataLoggerHeader.timestamp.desc()).first()

                    if last_header:
                        packet_time = last_header.timestamp + timedelta(seconds=8)
                        pkt_idx = last_header.packet_id_num + 1
                    else:
                        packet_time = base_timestamp - timedelta(seconds=(N - 1 - k) * 8)
                        pkt_idx = int(chunk[-4], 16) * 256 + int(chunk[-5], 16)

                    tot_pkts = int(chunk[-2], 16) * 256 + int(chunk[-3], 16)

                    # Extract 80 points (bytes 1 to 240)
                    points_list = []
                    data_tokens = chunk[1:-5]
                    for pt_idx in range(0, len(data_tokens), 3):
                        rx = int(data_tokens[pt_idx], 16)
                        ry = int(data_tokens[pt_idx+1], 16)
                        rz = int(data_tokens[pt_idx+2], 16)

                        x_val = rx - 256 if rx >= 128 else rx
                        y_val = ry - 256 if ry >= 128 else ry
                        z_val = rz - 256 if rz >= 128 else rz

                        points_list.append({"x": x_val, "y": y_val, "z": z_val})

                    # Save to datalogger_headers
                    header = DataLoggerHeader(
                        raw_packet_id=raw_packet.id,
                        app_id=app_id,
                        device_id=dev_id,
                        packet_id_num=pkt_idx,
                        total_packets=tot_pkts,
                        raw_data=" ".join(chunk).upper(),
                        timestamp=packet_time
                    )
                    db.add(header)
                    db.flush()

                    # Save points
                    db_points = [
                        DataLoggerPoint(
                            header_id=header.id,
                            point_index=idx,
                            x=pt["x"],
                            y=pt["y"],
                            z=pt["z"]
                        ) for idx, pt in enumerate(points_list)
                    ]
                    db.add_all(db_points)

                    # Save to sensor_packets
                    db_sensor = SensorPacket(
                        app_id=app_id,
                        data={
                            "type": "DataLogger",
                            "deviceId": dev_id,
                            "packetId": pkt_idx,
                            "totalPackets": tot_pkts,
                            "rawData": " ".join(chunk).upper(),
                            "points": points_list
                        },
                        timestamp=packet_time
                    )
                    db.add(db_sensor)

                    processed_summary.append({
                        "type": "DataLogger",
                        "deviceId": dev_id,
                        "packetId": pkt_idx,
                        "timestamp": packet_time.isoformat(),
                        "pointsCount": len(points_list)
                    })

            # Case 2: Pre-parsed DataLogger packet with points in JSON
            elif sensor_type == "DataLogger" or "points" in inner_data:
                device_id = str(inner_data.get("deviceId", "Unknown"))

                last_header = db.query(DataLoggerHeader).filter(
                    DataLoggerHeader.device_id == device_id
                ).order_by(DataLoggerHeader.timestamp.desc()).first()

                if last_header:
                    packet_time = last_header.timestamp + timedelta(seconds=8)
                    packet_id_num = last_header.packet_id_num + 1
                else:
                    packet_time = base_timestamp
                    packet_id_num = inner_data.get("packetId", 0)

                total_packets = inner_data.get("totalPackets", 0)
                points_list = inner_data.get("points", [])

                header = DataLoggerHeader(
                    raw_packet_id=raw_packet.id,
                    app_id=app_id,
                    device_id=device_id,
                    packet_id_num=packet_id_num,
                    total_packets=total_packets,
                    raw_data=raw_data,
                    timestamp=packet_time
                )
                db.add(header)
                db.flush()

                db_points = [
                    DataLoggerPoint(
                        header_id=header.id,
                        point_index=idx,
                        x=pt.get("x"),
                        y=pt.get("y"),
                        z=pt.get("z")
                    ) for idx, pt in enumerate(points_list) if isinstance(pt, dict)
                ]
                if db_points:
                    db.add_all(db_points)

                db_sensor = SensorPacket(
                    app_id=app_id,
                    data=pkt.get("data") if "data" in pkt else pkt,
                    timestamp=packet_time
                )
                db.add(db_sensor)

                processed_summary.append({
                    "type": "DataLogger",
                    "deviceId": device_id,
                    "packetId": packet_id_num,
                    "timestamp": packet_time.isoformat(),
                    "pointsCount": len(db_points)
                })

            # Case 3: Standard Telemetry packet
            else:
                db_sensor = SensorPacket(
                    app_id=app_id,
                    data=pkt.get("data") if "data" in pkt else pkt,
                    timestamp=base_timestamp
                )
                db.add(db_sensor)

                processed_summary.append({
                    "type": sensor_type,
                    "deviceId": inner_data.get("deviceId", "Unknown"),
                    "timestamp": base_timestamp.isoformat()
                })

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
