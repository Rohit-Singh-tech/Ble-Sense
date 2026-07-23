from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class RawPacket(Base):
    __tablename__ = "raw_packets"

    id = Column(Integer, primary_key=True, index=True)
    payload = Column(JSON, nullable=False)
    status = Column(String, default="pending", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=func.now(), index=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship to processed headers
    header = relationship("DataLoggerHeader", back_populates="raw_packet", uselist=False, cascade="all, delete-orphan")


class DataLoggerHeader(Base):
    __tablename__ = "datalogger_headers"

    id = Column(Integer, primary_key=True, index=True)
    raw_packet_id = Column(Integer, ForeignKey("raw_packets.id", ondelete="CASCADE"), nullable=True)
    
    app_id = Column(String, index=True, nullable=False)
    device_id = Column(String, index=True, nullable=False)
    packet_id_num = Column(Integer, nullable=False)
    total_packets = Column(Integer, default=0)
    raw_data = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), default=func.now())

    # Relationships
    raw_packet = relationship("RawPacket", back_populates="header")
    points = relationship("DataLoggerPoint", back_populates="header", cascade="all, delete-orphan")


class DataLoggerPoint(Base):
    __tablename__ = "datalogger_points"

    id = Column(Integer, primary_key=True, index=True)
    header_id = Column(Integer, ForeignKey("datalogger_headers.id", ondelete="CASCADE"), nullable=False)
    point_index = Column(Integer, nullable=False)
    
    x = Column(Integer, nullable=True)
    y = Column(Integer, nullable=True)
    z = Column(Integer, nullable=True)

    # Relationships
    header = relationship("DataLoggerHeader", back_populates="points")
