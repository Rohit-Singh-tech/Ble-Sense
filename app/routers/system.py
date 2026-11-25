from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from app.database import get_db, SessionLocal
from app.services.tunnel_manager import tunnel_manager

router = APIRouter(prefix="/system", tags=["System Management & Tunnel Registry"])

@router.post("/tunnel", status_code=status.HTTP_200_OK)
def register_tunnel_url(payload: Dict[str, Any] = Body(...)):
    """
    Register or update the active Cloudflare tunnel URL of the local PC.
    Called automatically on local PC startup by auto_register_tunnel.py.
    """
    tunnel_url = payload.get("tunnel_url")
    if not tunnel_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing 'tunnel_url' field in request body"
        )
    result = tunnel_manager.register_tunnel(tunnel_url)
    return result

@router.get("/tunnel", status_code=status.HTTP_200_OK)
def get_tunnel_info():
    """
    Retrieve the current active Cloudflare tunnel URL of the local PC.
    Queried by Android app and Web Dashboard on startup.
    """
    tunnel_url = tunnel_manager.get_tunnel_url()
    return {
        "status": "online" if tunnel_url else "not_configured",
        "tunnel_url": tunnel_url,
        "updated_at": tunnel_manager.updated_at,
        "is_local": tunnel_manager.is_local_instance
    }

@router.get("/status", status_code=status.HTTP_200_OK)
def get_system_health():
    """
    Check health of the primary database and tunnel failover readiness.
    """
    db_ok = False
    db_err = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception as e:
        db_err = str(e)

    tunnel_url = tunnel_manager.get_tunnel_url()
    failover_ready = bool(tunnel_url and not tunnel_manager.is_local_instance)

    return {
        "database": {
            "status": "connected" if db_ok else "unreachable",
            "error": db_err
        },
        "tunnel": {
            "status": "registered" if tunnel_url else "none",
            "url": tunnel_url,
            "last_seen": tunnel_manager.updated_at
        },
        "failover": {
            "active": not db_ok and failover_ready,
            "ready": failover_ready,
            "mode": "local_database_failover" if not db_ok and failover_ready else "primary_database"
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/ping")
def ping():
    return {"ping": "pong", "time": datetime.now(timezone.utc).isoformat()}
