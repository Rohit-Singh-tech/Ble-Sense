import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import httpx
from app.config import settings

logger = logging.getLogger("tunnel_manager")

STATE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "tunnel_state.json"))

class TunnelManager:
    def __init__(self):
        self.tunnel_url: Optional[str] = None
        self.updated_at: Optional[str] = None
        self.is_online: bool = False
        self._load_state()

    def _load_state(self):
        """Load state from local persistent JSON file if available."""
        if os.path.exists(STATE_FILE):
            try:
                with open(STATE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.tunnel_url = data.get("tunnel_url")
                    self.updated_at = data.get("updated_at")
                    self.is_online = data.get("is_online", True)
                    logger.info(f"Loaded active tunnel URL from state: {self.tunnel_url}")
            except Exception as e:
                logger.warning(f"Could not load tunnel state file: {e}")

    def _save_state(self):
        """Save current tunnel state to disk."""
        try:
            with open(STATE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "tunnel_url": self.tunnel_url,
                    "updated_at": self.updated_at,
                    "is_online": self.is_online
                }, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save tunnel state: {e}")

    @property
    def is_local_instance(self) -> bool:
        """Return True if this FastAPI server is running on the local PC."""
        db_url = (settings.DATABASE_URL or "").lower()
        return "localhost" in db_url or "127.0.0.1" in db_url or "blesense_local" in db_url or "sqlite" in db_url

    def register_tunnel(self, url: str) -> Dict[str, Any]:
        """Register or update the local PC's active Cloudflare tunnel URL."""
        clean_url = url.strip().rstrip("/")
        if not (clean_url.startswith("http://") or clean_url.startswith("https://")):
            clean_url = f"https://{clean_url}"

        self.tunnel_url = clean_url
        self.updated_at = datetime.now(timezone.utc).isoformat()
        self.is_online = True
        self._save_state()
        logger.info(f"Registered new active tunnel URL: {self.tunnel_url}")
        return {
            "status": "success",
            "tunnel_url": self.tunnel_url,
            "updated_at": self.updated_at
        }

    def get_tunnel_url(self) -> Optional[str]:
        return self.tunnel_url

    def has_active_tunnel(self) -> bool:
        return bool(self.tunnel_url and self.is_online)

    async def proxy_get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Proxy a GET request to the local PC via Cloudflare tunnel."""
        if not self.has_active_tunnel():
            return None
        target_url = f"{self.tunnel_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(target_url, params=params)
                if res.is_success:
                    return res.json()
                else:
                    logger.warning(f"Tunnel proxy returned HTTP {res.status_code} for {target_url}")
                    return None
        except Exception as e:
            logger.error(f"Failed to proxy GET to local tunnel ({target_url}): {e}")
            return None

    async def proxy_stream(self, path: str, params: Optional[Dict[str, Any]] = None):
        """Proxy a binary or streaming response (e.g. CSV export) from the local PC via Cloudflare tunnel."""
        if not self.has_active_tunnel():
            return None
        target_url = f"{self.tunnel_url}{path}"
        try:
            client = httpx.AsyncClient(timeout=120.0)
            req = client.build_request("GET", target_url, params=params)
            res = await client.send(req, stream=True)
            if res.is_success:
                return res, client
            else:
                await res.aclose()
                await client.aclose()
                logger.warning(f"Tunnel stream proxy returned HTTP {res.status_code} for {target_url}")
                return None
        except Exception as e:
            logger.error(f"Failed to proxy stream to local tunnel ({target_url}): {e}")
            return None

    async def mirror_packet_to_local(self, payload: Any):
        """Asynchronously mirror an ingested packet to the local PC database."""
        if self.is_local_instance or not self.has_active_tunnel():
            return
        target_url = f"{self.tunnel_url}/api/packets"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(target_url, json=payload)
                logger.info(f"Successfully mirrored packet to local PC at {target_url}")
        except Exception as e:
            logger.warning(f"Packet mirror to local PC failed (non-critical): {e}")

tunnel_manager = TunnelManager()
