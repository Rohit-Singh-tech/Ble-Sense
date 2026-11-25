"""
Auto-Registration Daemon for Cloudflare Quick Tunnel
Extracts the ephemeral Cloudflare URL from tunnel.log and automatically registers
it with the Render cloud backend at https://ble-sense-rqnu.onrender.com/api/system/tunnel.
Maintains a periodic heartbeat so the cloud server and Android app always know the PC's live address.
"""

import os
import re
import time
import sys
import json
import logging
from datetime import datetime, timezone
import urllib.request
import urllib.error

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TUNNEL_LOG = os.path.join(BASE_DIR, "tunnel.log")
RENDER_ENDPOINT = "https://ble-sense-rqnu.onrender.com/api/system/tunnel"
LOCAL_ENDPOINT = "http://localhost:8000/api/system/tunnel"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(BASE_DIR, "tunnel_sync.log"), encoding="utf-8")
    ]
)
logger = logging.getLogger("tunnel_sync")

TUNNEL_REGEX = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

def find_active_tunnel_url() -> str | None:
    if not os.path.exists(TUNNEL_LOG):
        return None
    try:
        with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        matches = TUNNEL_REGEX.findall(content)
        if matches:
            # Return the latest match in the file
            return matches[-1]
    except Exception as e:
        logger.error(f"Error reading {TUNNEL_LOG}: {e}")
    return None

def register_url(endpoint: str, url: str) -> bool:
    payload = json.dumps({"tunnel_url": url}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "BleSense-TunnelRegister/1.0"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            if res.status in (200, 201):
                return True
    except urllib.error.HTTPError as e:
        logger.warning(f"HTTP error {e.code} registering to {endpoint}")
    except Exception as e:
        logger.warning(f"Connection failed registering to {endpoint}: {e}")
    return False

def main():
    logger.info("Starting BLE Sense Cloudflare Tunnel Auto-Registry Daemon...")
    last_registered_url = None
    
    # Initial discovery loop
    active_url = None
    for attempt in range(1, 31):
        active_url = find_active_tunnel_url()
        if active_url:
            break
        logger.info(f"Waiting for cloudflared to produce a tunnel URL (attempt {attempt}/30)...")
        time.sleep(2)

    if not active_url:
        logger.error("Could not find active trycloudflare.com URL in tunnel.log after 60 seconds.")
    else:
        logger.info(f"Discovered active Cloudflare Tunnel: {active_url}")

    # Main continuous heartbeat loop
    while True:
        current_url = find_active_tunnel_url()
        if current_url:
            # Register with local server
            register_url(LOCAL_ENDPOINT, current_url)

            # Register with Render Cloud backend
            if current_url != last_registered_url:
                logger.info(f"New or changed tunnel detected! Pushing to Render: {current_url}")
                ok = register_url(RENDER_ENDPOINT, current_url)
                if ok:
                    logger.info(f"[SUCCESS] Registered {current_url} with Render Cloud backend!")
                    last_registered_url = current_url
                else:
                    logger.warning("Push to Render failed. Will retry on next heartbeat.")
            else:
                # Periodic heartbeat ping every cycle
                register_url(RENDER_ENDPOINT, current_url)

        time.sleep(60)

if __name__ == "__main__":
    main()
