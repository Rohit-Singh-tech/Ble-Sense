import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import SessionLocal
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint
from app.models.packet import SensorPacket

# Global asynchronous in-memory queue
packet_queue = asyncio.Queue()

async def packet_worker():
    """
    Background worker that continuously processes raw packets from the queue.
    Ingests dynamic DataLogger points and saves them to PostgreSQL structured tables.
    Also handles multi-packet hex binary decoding and general sensor database offloading.
    """
    print("🚀 Background worker started. Waiting for DataLogger/Sensor packets...")
    while True:
        try:
            # Wait for next raw packet ID from the queue
            packet_id = await packet_queue.get()
            
            # Open db session
            db: Session = SessionLocal()
            try:
                # Fetch raw packet record
                raw_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
                if not raw_packet or raw_packet.status != "pending":
                    continue
                
                payload = raw_packet.payload
                
                # Standardize single dictionary payload into a list
                packets_list = payload if isinstance(payload, list) else [payload]
                
                for pkt in packets_list:
                    # Resolve base timestamp of the packet / request
                    timestamp_raw = pkt.get("timestamp") if isinstance(pkt, dict) else None
                    if not timestamp_raw and isinstance(pkt, dict) and "data" in pkt:
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
                    data_wrapper = pkt.get("data", pkt) if isinstance(pkt, dict) else {}
                    inner_data = data_wrapper.get("data", data_wrapper) if isinstance(data_wrapper, dict) else {}
                    
                    if not isinstance(inner_data, dict):
                        inner_data = pkt if isinstance(pkt, dict) else {}
                        data_wrapper = pkt if isinstance(pkt, dict) else {}

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
                            # Fallback to space split
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
                                # Fallback to back-calculated offset from base timestamp
                                packet_time = base_timestamp - timedelta(seconds=(N - 1 - k) * 8)
                                # Current packet (bytes 241, 242) -> little-endian
                                pkt_idx = int(chunk[-4], 16) * 256 + int(chunk[-5], 16)

                            # Total packets (bytes 243, 244) -> little-endian
                            tot_pkts = int(chunk[-2], 16) * 256 + int(chunk[-3], 16)

                            # Extract 80 points (bytes 1 to 240)
                            points_list = []
                            data_tokens = chunk[1:-5]
                            for pt_idx in range(0, len(data_tokens), 3):
                                rx = int(data_tokens[pt_idx], 16)
                                ry = int(data_tokens[pt_idx+1], 16)
                                rz = int(data_tokens[pt_idx+2], 16)

                                # Two's complement signed 8-bit conversion
                                x_val = rx - 256 if rx >= 128 else rx
                                y_val = ry - 256 if ry >= 128 else ry
                                z_val = rz - 256 if rz >= 128 else rz

                                points_list.append({
                                    "x": x_val,
                                    "y": y_val,
                                    "z": z_val
                                })

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

                            # Also save a representation to sensor_packets table for overview mapping
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

                    # Case 2: Pre-parsed DataLogger packet with points in JSON
                    elif sensor_type == "DataLogger" or "points" in inner_data:
                        device_id = str(inner_data.get("deviceId", "Unknown"))

                        # Query database for the last header of the same Device ID
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
                            timestamp=base_timestamp
                        )
                        db.add(db_sensor)

                    # Case 3: Standard Telemetry packet (SHT40, Soil Sensor, Ammonia Sensor, sen66, etc.)
                    else:
                        db_sensor = SensorPacket(
                            app_id=app_id,
                            data=pkt.get("data") if "data" in pkt else pkt,
                            timestamp=base_timestamp
                        )
                        db.add(db_sensor)

                # Mark raw packet as processed
                raw_packet.status = "processed"
                raw_packet.processed_at = func.now()
                db.commit()
                print(f"✓ Background Worker: Processed Raw Packet ID {packet_id} successfully.")
                
            except Exception as e:
                db.rollback()
                print(f"❌ Background Worker: Error processing Raw Packet ID {packet_id}: {e}")
                try:
                    # Update status to failed
                    err_packet = db.query(RawPacket).filter(RawPacket.id == packet_id).first()
                    if err_packet:
                        err_packet.status = "failed"
                        db.commit()
                except Exception:
                    pass
            finally:
                db.close()
                packet_queue.task_done()
        except asyncio.CancelledError:
            print("Background worker task cancelled.")
            break
        except Exception as e:
            print(f"Background worker loop error: {e}")
            await asyncio.sleep(1)
