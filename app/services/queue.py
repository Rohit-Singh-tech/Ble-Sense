import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.database import SessionLocal
from app.models.datalogger import RawPacket, DataLoggerHeader, DataLoggerPoint
from app.models.packet import SensorPacket
from app.services.packet_processor import process_payload

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
                
                process_payload(raw_packet.payload, db, raw_packet_id=raw_packet.id)
                
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