import csv
import io
import json
import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import Text, cast, text
from sqlalchemy.orm import Session, joinedload, load_only
from sqlalchemy.sql import func
from typing import List, Optional
from app.database import get_db, SessionLocal
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint
from app.models.packet import SensorPacket
from app.schemas.datalogger import RawPacketOut, DataLoggerHeaderOut, PaginatedRawPackets, PaginatedDataLoggerHeaders
from app.services.queue import packet_queue
from app.services.tunnel_manager import tunnel_manager

router = APIRouter(prefix="/packets/datalogger", tags=["DataLogger Pipeline"])

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_datalogger_packet(request: Request, db: Session = Depends(get_db)):
    """
    Ingest raw DataLogger sensor packets asynchronously.
    Saves payload directly in raw format and pushes to asyncio.Queue for processing.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body"
        )
        
    # Create raw packet entry in pending status
    raw_packet = RawPacket(
        payload=body,
        status="pending",
        created_at=func.now()
    )
    db.add(raw_packet)
    db.commit()
    db.refresh(raw_packet)
    
    # Enqueue raw packet ID for background processing
    await packet_queue.put(raw_packet.id)
    
    return {
        "message": "Packet received and enqueued for background processing",
        "raw_packet_id": raw_packet.id,
        "status": "pending"
    }


@router.get("/raw", response_model=PaginatedRawPackets)
async def get_raw_packets(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    sort_order: str = Query("desc", alias="sortOrder"),
    db: Session = Depends(get_db)
):
    """
    Retrieve raw enqueued packets with pagination, filtering, and sorting.
    Falls back to local database via tunnel if primary database is unreachable.
    """
    try:
        query = db.query(RawPacket)
        if status_filter and status_filter != 'All':
            query = query.filter(RawPacket.status == status_filter)
            
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(
                func.lower(cast(RawPacket.payload, Text)).like(search_term)
            )
            
        if sort_order == 'asc':
            query = query.order_by(RawPacket.created_at.asc())
        else:
            query = query.order_by(RawPacket.created_at.desc())
            
        total = query.count()
        skip = (page - 1) * limit
        records = query.offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "records": records
        }
    except Exception as e:
        if not tunnel_manager.is_local_instance and tunnel_manager.has_active_tunnel():
            proxied = await tunnel_manager.proxy_get(request.url.path, dict(request.query_params))
            if proxied is not None:
                return proxied
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch raw packets: {str(e)}"
        )


@router.get("/processed", response_model=PaginatedDataLoggerHeaders)
async def get_processed_headers(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    device_id: Optional[str] = Query(None, alias="deviceId"),
    start_time: Optional[datetime] = Query(None, alias="startTime"),
    end_time: Optional[datetime] = Query(None, alias="endTime"),
    sort_order: str = Query("desc", alias="sortOrder"),
    include_points: bool = Query(False, description="Include the parsed XYZ samples"),
    db: Session = Depends(get_db)
):
    """
    Retrieve processed DataLogger headers with pagination, filtering, and sorting.
    Falls back to local database via tunnel if primary database is unreachable.
    """
    try:
        query = db.query(DataLoggerHeader)
        
        if device_id and device_id != 'All':
            query = query.filter(DataLoggerHeader.device_id == device_id)
            
        if start_time:
            query = query.filter(DataLoggerHeader.timestamp >= start_time)
        if end_time:
            query = query.filter(DataLoggerHeader.timestamp <= end_time)
            
        if sort_order == 'asc':
            query = query.order_by(DataLoggerHeader.timestamp.asc())
        else:
            query = query.order_by(DataLoggerHeader.timestamp.desc())
            
        total = query.count()
        skip = (page - 1) * limit
        
        headers = query.options(
            joinedload(DataLoggerHeader.raw_packet).load_only(
                RawPacket.id,
                RawPacket.status,
                RawPacket.created_at,
                RawPacket.processed_at
            )
        ).offset(skip).limit(limit).all()
        
        return {
            "total": total,
            "records": [
                {
                    "id": h.id,
                    "raw_packet_id": h.raw_packet_id,
                    "app_id": h.app_id,
                    "device_id": h.device_id,
                    "packet_id_num": h.packet_id_num,
                    "total_packets": h.total_packets,
                    "raw_data": h.raw_data,
                    "timestamp": h.timestamp,
                    "created_at": h.created_at,
                    "raw_packet": h.raw_packet,
                    "points": h.points if include_points else None
                } for h in headers
            ]
        }
    except Exception as e:
        if not tunnel_manager.is_local_instance and tunnel_manager.has_active_tunnel():
            proxied = await tunnel_manager.proxy_get(request.url.path, dict(request.query_params))
            if proxied is not None:
                return proxied
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch processed headers: {str(e)}"
        )


@router.post("/{packet_id}/reprocess")
async def reprocess_raw_packet(packet_id: int, db: Session = Depends(get_db)):
    """
    Re-enqueue an existing raw packet for processing.
    Updates status to 'pending' and adds to the queue.
    """
    raw_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
    if not raw_packet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Raw packet not found"
        )
        
    raw_packet.status = "pending"
    raw_packet.processed_at = None
    db.commit()
    
    # Enqueue packet ID
    await packet_queue.put(raw_packet.id)
    
    return {"message": f"Packet #{packet_id} successfully re-enqueued for processing"}


@router.get("/processed/{header_id}", response_model=DataLoggerHeaderOut)
async def get_processed_header(header_id: int, request: Request, db: Session = Depends(get_db)):
    """
    Retrieve a single processed DataLogger header with its XYZ samples.
    Falls back to local database via tunnel if primary database is unreachable.
    """
    try:
        header = db.query(DataLoggerHeader).filter(DataLoggerHeader.id == header_id).first()
        if not header:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processed header not found"
            )
        return header
    except HTTPException:
        raise
    except Exception as e:
        if not tunnel_manager.is_local_instance and tunnel_manager.has_active_tunnel():
            proxied = await tunnel_manager.proxy_get(request.url.path)
            if proxied is not None:
                return proxied
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch header: {str(e)}"
        )


@router.get("/export/csv")
async def export_datalogger_csv(
    request: Request,
    app_id: Optional[str] = Query(None, alias="appId"),
    sensor_type: Optional[str] = Query(None, alias="type"),
    device_id: Optional[str] = Query(None, alias="deviceId"),
    start_time: Optional[datetime] = Query(None, alias="startTime"),
    end_time: Optional[datetime] = Query(None, alias="endTime"),
    search: Optional[str] = Query(None),
    export_type: str = Query("packets", alias="exportType", description="export mode: 'packets', 'sensor_packets', or 'samples'"),
    sort_order: str = Query("desc", alias="sortOrder"),
    db: Session = Depends(get_db)
):
    """
    Export sensor packets or DataLogger telemetry matching filters as a streaming CSV file.
    exportType='sensor_packets': 1 row per raw BLE sensor packet (Overview feed).
    exportType='packets': 1 row per packet header (metadata, timestamps, sequence num, sample count).
    exportType='samples': 1 row per 3D XYZ spatial sample.
    Seamlessly proxies to the local PC via Cloudflare tunnel if primary cloud database is disconnected.
    """
    timestamp_label = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    dev_label = device_id if (device_id and device_id != 'All') else "all_devices"
    prefix = "sensor_packets" if export_type == "sensor_packets" else f"datalogger_{export_type}"
    filename = f"{prefix}_{dev_label}_{timestamp_label}.csv"

    # Failover Check: Test if primary DB is reachable. If not, proxy stream from local PC tunnel
    db_connected = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_connected = False

    if not db_connected and not tunnel_manager.is_local_instance and tunnel_manager.has_active_tunnel():
        stream_res = await tunnel_manager.proxy_stream(request.url.path, dict(request.query_params))
        if stream_res:
            res, client = stream_res
            async def stream_from_tunnel():
                try:
                    async for chunk in res.aiter_bytes():
                        yield chunk
                finally:
                    await res.aclose()
                    await client.aclose()
            return StreamingResponse(
                stream_from_tunnel(),
                media_type="text/csv",
                headers={
                    "Content-Disposition": res.headers.get("content-disposition", f'attachment; filename="{filename}"'),
                    "Access-Control-Expose-Headers": "Content-Disposition"
                }
            )

    def generate_csv():
        db_stream = SessionLocal()
        try:
            output = io.StringIO()
            writer = csv.writer(output)
            BATCH_SIZE = 100

            if export_type == "sensor_packets":
                writer.writerow([
                    "Packet_ID",
                    "Timestamp_UTC",
                    "App_ID",
                    "Sensor_Type",
                    "Device_ID",
                    "Packet_Sequence_Num",
                    "Total_Packets",
                    "Points_Count",
                    "Raw_Hex_Data",
                    "Telemetry_Data"
                ])
                output.seek(0)
                yield output.read()
                output.truncate(0)
                output.seek(0)

                sp_query = db_stream.query(SensorPacket)
                if app_id and app_id != 'All':
                    sp_query = sp_query.filter(SensorPacket.app_id == app_id)
                if sensor_type and sensor_type != 'All':
                    if sensor_type == 'DataLogger':
                        sp_query = sp_query.filter(
                            (SensorPacket.data['type'].as_string() == 'DataLogger') |
                            (SensorPacket.data['data']['type'].as_string() == 'DataLogger') |
                            (SensorPacket.data['deviceId'].is_not(None)) |
                            (SensorPacket.data['data']['deviceId'].is_not(None))
                        )
                    else:
                        sp_query = sp_query.filter(
                            (SensorPacket.data['type'].as_string() == sensor_type) |
                            (SensorPacket.data['data']['type'].as_string() == sensor_type)
                        )
                if device_id and device_id != 'All':
                    sp_query = sp_query.filter(
                        (SensorPacket.data['deviceId'].as_string() == str(device_id)) |
                        (SensorPacket.data['data']['deviceId'].as_string() == str(device_id))
                    )
                if start_time:
                    sp_query = sp_query.filter(SensorPacket.timestamp >= start_time)
                if end_time:
                    sp_query = sp_query.filter(SensorPacket.timestamp <= end_time)
                if search:
                    s_term = f"%{search.lower()}%"
                    sp_query = sp_query.filter(
                        (func.lower(SensorPacket.app_id).like(s_term)) |
                        (func.lower(SensorPacket.data['deviceId'].as_string()).like(s_term)) |
                        (func.lower(SensorPacket.data['data']['deviceId'].as_string()).like(s_term))
                    )
                if sort_order == 'asc':
                    sp_query = sp_query.order_by(SensorPacket.timestamp.asc())
                else:
                    sp_query = sp_query.order_by(SensorPacket.timestamp.desc())

                total_sp = sp_query.count()
                offset = 0
                while offset < total_sp:
                    packets_chunk = sp_query.offset(offset).limit(BATCH_SIZE).all()
                    for sp in packets_chunk:
                        data_dict = sp.data if isinstance(sp.data, dict) else {}
                        inner = data_dict.get("data", data_dict) if isinstance(data_dict, dict) else {}
                        
                        dev_id = str(data_dict.get("deviceId") or inner.get("deviceId") or "")
                        stype = str(data_dict.get("type") or inner.get("type") or "Unknown")
                        if stype == "Unknown":
                            if inner.get("temperature") and inner.get("humidity"):
                                stype = "SHT40"
                            elif inner.get("nitrogen") or inner.get("phosphorus"):
                                stype = "Soil Sensor"
                            elif inner.get("co2") or inner.get("pm25"):
                                stype = "sen66"
                            elif inner.get("lux"):
                                stype = "Lux Sensor"
                            elif inner.get("ammonia"):
                                stype = "Ammonia Sensor"
                            elif dev_id:
                                stype = "DataLogger"

                        pkt_seq = data_dict.get("packetId") or inner.get("packetId") or ""
                        total_pkts = data_dict.get("totalPackets") or inner.get("totalPackets") or ""
                        pts_count = data_dict.get("pointsCount") or inner.get("pointsCount") or ""
                        raw_hex = data_dict.get("rawData") or inner.get("rawData") or ""
                        ts_str = sp.timestamp.isoformat() if sp.timestamp else ""
                        telemetry_str = json.dumps(inner) if inner else ""

                        writer.writerow([
                            sp.id,
                            ts_str,
                            sp.app_id,
                            stype,
                            dev_id,
                            pkt_seq,
                            total_pkts,
                            pts_count,
                            raw_hex,
                            telemetry_str
                        ])
                        output.seek(0)
                        yield output.read()
                        output.truncate(0)
                        output.seek(0)
                    offset += BATCH_SIZE

            elif export_type == "samples":
                writer.writerow([
                    "Header_ID",
                    "Timestamp_UTC",
                    "Device_ID",
                    "Packet_Sequence_Num",
                    "Total_Packets",
                    "Point_Index",
                    "X",
                    "Y",
                    "Z",
                    "Vector_Magnitude"
                ])
                output.seek(0)
                yield output.read()
                output.truncate(0)
                output.seek(0)

                dl_query = db_stream.query(DataLoggerHeader)
                if device_id and device_id != 'All':
                    dl_query = dl_query.filter(DataLoggerHeader.device_id == str(device_id))
                if start_time:
                    dl_query = dl_query.filter(DataLoggerHeader.timestamp >= start_time)
                if end_time:
                    dl_query = dl_query.filter(DataLoggerHeader.timestamp <= end_time)
                if sort_order == 'asc':
                    dl_query = dl_query.order_by(DataLoggerHeader.timestamp.asc())
                else:
                    dl_query = dl_query.order_by(DataLoggerHeader.timestamp.desc())

                total_headers = dl_query.count()
                offset = 0
                while offset < total_headers:
                    headers = dl_query.options(joinedload(DataLoggerHeader.points)).offset(offset).limit(BATCH_SIZE).all()
                    for h in headers:
                        ts_str = h.timestamp.isoformat() if h.timestamp else ""
                        if h.points:
                            for pt in h.points:
                                x_val = pt.x if pt.x is not None else 0
                                y_val = pt.y if pt.y is not None else 0
                                z_val = pt.z if pt.z is not None else 0
                                mag = round(math.sqrt(x_val * x_val + y_val * y_val + z_val * z_val), 2)
                                writer.writerow([
                                    h.id,
                                    ts_str,
                                    h.device_id,
                                    h.packet_id_num,
                                    h.total_packets,
                                    pt.point_index,
                                    x_val,
                                    y_val,
                                    z_val,
                                    mag
                                ])
                        output.seek(0)
                        yield output.read()
                        output.truncate(0)
                        output.seek(0)
                    offset += BATCH_SIZE

            else:
                writer.writerow([
                    "Header_ID",
                    "Timestamp_UTC",
                    "App_ID",
                    "Device_ID",
                    "Packet_Sequence_Num",
                    "Total_Packets",
                    "Points_Count",
                    "Raw_Hex_Data",
                    "Created_At"
                ])
                output.seek(0)
                yield output.read()
                output.truncate(0)
                output.seek(0)

                dl_query = db_stream.query(DataLoggerHeader)
                if device_id and device_id != 'All':
                    dl_query = dl_query.filter(DataLoggerHeader.device_id == str(device_id))
                if start_time:
                    dl_query = dl_query.filter(DataLoggerHeader.timestamp >= start_time)
                if end_time:
                    dl_query = dl_query.filter(DataLoggerHeader.timestamp <= end_time)
                if sort_order == 'asc':
                    dl_query = dl_query.order_by(DataLoggerHeader.timestamp.asc())
                else:
                    dl_query = dl_query.order_by(DataLoggerHeader.timestamp.desc())

                total_headers = dl_query.count()
                offset = 0
                while offset < total_headers:
                    headers = dl_query.options(joinedload(DataLoggerHeader.points)).offset(offset).limit(BATCH_SIZE).all()
                    for h in headers:
                        ts_str = h.timestamp.isoformat() if h.timestamp else ""
                        created_str = h.created_at.isoformat() if h.created_at else ""
                        pts_count = len(h.points) if h.points else 0
                        writer.writerow([
                            h.id,
                            ts_str,
                            h.app_id,
                            h.device_id,
                            h.packet_id_num,
                            h.total_packets,
                            pts_count,
                            h.raw_data or "",
                            created_str
                        ])
                        output.seek(0)
                        yield output.read()
                        output.truncate(0)
                        output.seek(0)
                    offset += BATCH_SIZE
        finally:
            db_stream.close()

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )