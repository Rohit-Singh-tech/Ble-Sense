from sqlalchemy import Column, Integer, String, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base

class SensorPacket(Base):
    __tablename__ = "sensor_packets"

    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(String, index=True, nullable=False)
    data = Column(JSON, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
