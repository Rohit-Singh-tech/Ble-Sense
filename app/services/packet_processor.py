from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Union, Optional
from sqlalchemy.orm import Session
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint
from app.models.packet import SensorPacket


def _normalize_utc(dt: datetime) -> datetime:
    """Ensure datetime has timezone.utc."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def process_payload(
    payload: Union[Dict[str, Any], List[Dict[str, Any]]],
    db: Session,
    raw_packet_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Ingest, decode, timestamp, and persist BLE sensor packets.
    
    Timestamping rules:
    1. Anchored to upload/receive time (current server UTC time).
    2. Within a batch, packets are sequenced 8 seconds back from each to next:
       Packet 0 -> receive_time
       Packet 1 -> receive_time - 8s
       Packet k -> receive_time - (k * 8s)
    3. Collision Management: If newly calculated timestamps overlap with
       previously uploaded records for the same device, all existing colliding
       records are shifted back in time by:
       delta = (t_max_colliding - t_start) + 8s
       so that the latest previous packet sits exactly 8 seconds before the
       oldest packet of the new batch.
    """
    receive_time = datetime.now(timezone.utc)
    packets_list = payload if isinstance(payload, list) else [payload]
    
    # Structure to hold decoded packets grouped by category
    # Each entry in datalogger_by_device[device_id] is a dict:
    # { "app_id", "packet_id_num", "total_packets", "raw_data", "points", "raw_pkt_dict" }
    datalogger_by_device: Dict[str, List[Dict[str, Any]]] = {}
    standard_telemetry: List[Dict[str, Any]] = []

    for pkt_idx_in_list, pkt in enumerate(packets_list):
        if not isinstance(pkt, dict):
            continue

        # Extract inner data wrapper
        data_wrapper = pkt.get("data", pkt) if isinstance(pkt, dict) else {}
        inner_data = data_wrapper.get("data", data_wrapper) if isinstance(data_wrapper, dict) else {}
        
        if not isinstance(inner_data, dict):
            inner_data = pkt if isinstance(pkt, dict) else {}
            data_wrapper = pkt if isinstance(pkt, dict) else {}

        app_id = inner_data.get("appId") or pkt.get("appId") or "Unknown"
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
                if len(chunk) == 246:
                    sub_packets.append(chunk)

        # Case 1: Ingesting raw hex stream containing 246-byte sub-packets
        if sub_packets:
            for chunk in sub_packets:
                pkt_idx = int(chunk[1], 16) * 256 + int(chunk[0], 16)
                dev_id = str(int(chunk[2], 16))
                tot_pkts = int(chunk[244], 16) * 256 + int(chunk[243], 16)

                points_list = []
                data_tokens = chunk[3:243]
                for pt_idx in range(0, len(data_tokens), 3):
                    rx = int(data_tokens[pt_idx], 16)
                    ry = int(data_tokens[pt_idx+1], 16)
                    rz = int(data_tokens[pt_idx+2], 16)

                    # Two's complement signed 8-bit conversion
                    x_val = rx - 256 if rx >= 128 else rx
                    y_val = ry - 256 if ry >= 128 else ry
                    z_val = rz - 256 if rz >= 128 else rz

                    points_list.append({"x": x_val, "y": y_val, "z": z_val})

                if dev_id not in datalogger_by_device:
                    datalogger_by_device[dev_id] = []

                datalogger_by_device[dev_id].append({
                    "app_id": app_id,
                    "device_id": dev_id,
                    "packet_id_num": pkt_idx,
                    "total_packets": tot_pkts,
                    "raw_data": " ".join(chunk).upper(),
                    "points": points_list,
                    "raw_pkt_dict": pkt
                })

        # Case 2: Pre-parsed DataLogger packet with points in JSON
        elif sensor_type == "DataLogger" or "points" in inner_data:
            dev_id = str(inner_data.get("deviceId", "Unknown"))
            try:
                packet_id_num = int(inner_data.get("packetId", 0) or 0)
            except (ValueError, TypeError):
                packet_id_num = 0

            try:
                total_packets = int(inner_data.get("totalPackets", 0) or 0)
            except (ValueError, TypeError):
                total_packets = 0

            points_list = inner_data.get("points", [])
            points_cleaned = []
            for pt in points_list:
                if isinstance(pt, dict):
                    points_cleaned.append({
                        "x": pt.get("x", 0),
                        "y": pt.get("y", 0),
                        "z": pt.get("z", 0)
                    })

            if dev_id not in datalogger_by_device:
                datalogger_by_device[dev_id] = []

            datalogger_by_device[dev_id].append({
                "app_id": app_id,
                "device_id": dev_id,
                "packet_id_num": packet_id_num,
                "total_packets": total_packets,
                "raw_data": raw_data,
                "points": points_cleaned,
                "raw_pkt_dict": pkt
            })

        # Case 3: Standard Telemetry packet (SHT40, Soil Sensor, sen66, Lux, etc.)
        else:
            standard_telemetry.append({
                "app_id": app_id,
                "sensor_type": sensor_type,
                "inner_data": inner_data,
                "raw_pkt_dict": pkt
            })

    processed_summary = []

    # -------------------------------------------------------------
    # Process DataLogger packets by device with collision shift
    # -------------------------------------------------------------
    for dev_id, items in datalogger_by_device.items():
        M = len(items)
        if M == 0:
            continue

        # Timestamps for this batch: item 0 gets receive_time, item k gets receive_time - k*8s
        # Oldest packet in this new batch will have timestamp t_start
        t_start = receive_time - timedelta(seconds=(M - 1) * 8)
        t_end = receive_time

        # Check for collisions with existing records in datalogger_headers
        # Any existing record with timestamp >= t_start - 7s is in collision range
        collision_threshold = t_start - timedelta(seconds=7)
        existing_headers = db.query(DataLoggerHeader).filter(
            DataLoggerHeader.device_id == dev_id
        ).all()

        colliding_headers = [
            h for h in existing_headers
            if _normalize_utc(h.timestamp) >= collision_threshold
        ]

        if colliding_headers:
            t_max_colliding = max(_normalize_utc(h.timestamp) for h in colliding_headers)
            # Calculate shift amount to place t_max_colliding exactly 8s before t_start
            delta = (t_max_colliding - t_start) + timedelta(seconds=8)

            # Shift all existing DataLoggerHeader records of this device that are <= t_max_colliding
            for h in existing_headers:
                if _normalize_utc(h.timestamp) <= t_max_colliding:
                    h.timestamp = _normalize_utc(h.timestamp) - delta

            # Also shift corresponding SensorPacket records for this device
            all_sensor_packets = db.query(SensorPacket).all()
            for sp in all_sensor_packets:
                data_dict = sp.data if isinstance(sp.data, dict) else {}
                inner = data_dict.get("data", data_dict) if isinstance(data_dict, dict) else {}
                sp_dev = str(data_dict.get("deviceId") or inner.get("deviceId") or "")
                if sp_dev == str(dev_id):
                    sp_time = _normalize_utc(sp.timestamp) if sp.timestamp else None
                    if sp_time and sp_time <= t_max_colliding:
                        sp.timestamp = sp_time - delta

            db.flush()

        # Now insert new packets for this device
        for k, item in enumerate(items):
            packet_time = receive_time - timedelta(seconds=k * 8)

            header = DataLoggerHeader(
                raw_packet_id=raw_packet_id,
                app_id=item["app_id"],
                device_id=item["device_id"],
                packet_id_num=item["packet_id_num"],
                total_packets=item["total_packets"],
                raw_data=item["raw_data"],
                timestamp=packet_time
            )
            db.add(header)
            db.flush()

            if item["points"]:
                db_points = [
                    DataLoggerPoint(
                        header_id=header.id,
                        point_index=idx,
                        x=pt["x"],
                        y=pt["y"],
                        z=pt["z"]
                    ) for idx, pt in enumerate(item["points"])
                ]
                db.add_all(db_points)

            # Insert to sensor_packets for Overview dashboard mapping
            pkt_dict = item["raw_pkt_dict"]
            sensor_packet_data = {
                "type": "DataLogger",
                "deviceId": item["device_id"],
                "packetId": item["packet_id_num"],
                "totalPackets": item["total_packets"],
                "rawData": item["raw_data"],
                "points": item["points"]
            }
            if "data" in pkt_dict and isinstance(pkt_dict["data"], dict):
                # Preserve any existing envelope fields while updating inner payload
                envelope = dict(pkt_dict["data"])
                envelope["deviceId"] = item["device_id"]
                envelope["packetId"] = item["packet_id_num"]
                envelope["totalPackets"] = item["total_packets"]
                envelope["points"] = item["points"]
                sensor_packet_data = envelope

            db_sensor = SensorPacket(
                app_id=item["app_id"],
                data=sensor_packet_data,
                timestamp=packet_time
            )
            db.add(db_sensor)

            processed_summary.append({
                "type": "DataLogger",
                "deviceId": item["device_id"],
                "packetId": item["packet_id_num"],
                "timestamp": packet_time.isoformat(),
                "pointsCount": len(item["points"])
            })

    # -------------------------------------------------------------
    # Process Standard Telemetry packets
    # -------------------------------------------------------------
    for k, item in enumerate(standard_telemetry):
        packet_time = receive_time - timedelta(seconds=k * 8)
        pkt_dict = item["raw_pkt_dict"]

        db_sensor = SensorPacket(
            app_id=item["app_id"],
            data=pkt_dict.get("data") if "data" in pkt_dict else pkt_dict,
            timestamp=packet_time
        )
        db.add(db_sensor)

        processed_summary.append({
            "type": item["sensor_type"],
            "deviceId": item["inner_data"].get("deviceId", "Unknown"),
            "timestamp": packet_time.isoformat()
        })

    return processed_summary
