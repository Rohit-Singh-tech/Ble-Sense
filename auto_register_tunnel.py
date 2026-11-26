"""
Auto-Registration & Self-Healing Watchdog Daemon for Cloudflare Quick Tunnel.
- Monitors tunnel.log and health endpoint.
- If Cloudflare terminates the ephemeral session ("Unauthorized: Tunnel not found"),
  the watchdog automatically terminates cloudflared, spawns a fresh tunnel instance,
  and re-registers the new live URL with both the local server and Render cloud backend.
- Maintains continuous heartbeats so the Android app and Web Dashboard always know the PC's live address.
"""

import os
import re
import sys
import time
import json
import logging
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TUNNEL_LOG = os.path.join(BASE_DIR, "tunnel.log")
RENDER_ENDPOINT = "https://ble-sense-rqnu.onrender.com/api/system/tunnel"
LOCAL_ENDPOINT = "http://localhost:8000/api/system/tunnel"
CLOUDFLARED_PATH = r"C:\cloudflared\cloudflared.exe"

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
            return matches[-1]
    except Exception as e:
        logger.error(f"Error reading {TUNNEL_LOG}: {e}")
    return None

def is_tunnel_session_expired() -> bool:
    """
    Check if Cloudflare edge has terminated the session ('Unauthorized: Tunnel not found').
    """
    if not os.path.exists(TUNNEL_LOG):
        return False
    try:
        with open(TUNNEL_LOG, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        recent_lines = "".join(lines[-25:])
        if "Unauthorized: Tunnel not found" in recent_lines or "Register tunnel error from server side" in recent_lines:
            return True
    except Exception as e:
        logger.error(f"Error checking tunnel expiration: {e}")
    return False

def test_tunnel_ping(tunnel_url: str) -> bool:
    """
    Verify public reachability through the Cloudflare edge.
    """
    try:
        ping_url = f"{tunnel_url.rstrip('/')}/api/system/ping"
        req = urllib.request.Request(
            ping_url,
            headers={"User-Agent": "BleSense-TunnelWatchdog/1.0"},
            method="GET"
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                body = json.loads(res.read().decode("utf-8"))
                return body.get("ping") == "pong"
    except Exception:
        pass
    return False

def restart_cloudflared() -> str | None:
    """
    Self-healing: Kill stalled cloudflared, reset log, and start fresh tunnel process.
    """
    logger.warning(" [WATCHDOG] Tunnel session expired or unresponsive. Restarting cloudflared...")
    
    # 1. Kill existing cloudflared
    try:
        subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe"], capture_output=True, text=True)
    except Exception as e:
        logger.error(f"Failed to kill cloudflared: {e}")
        
    time.sleep(2)

    # 2. Reset tunnel log
    try:
        with open(TUNNEL_LOG, "w", encoding="utf-8") as f:
            f.write(f"--- Watchdog Restarted at {datetime.now(timezone.utc).isoformat()} ---\n")
    except Exception as e:
        logger.warning(f"Failed to reset tunnel.log: {e}")

    # 3. Launch cloudflared
    if not os.path.exists(CLOUDFLARED_PATH):
        logger.error(f"cloudflared binary not found at {CLOUDFLARED_PATH}")
        return None

    cmd = [
        CLOUDFLARED_PATH,
        "tunnel",
        "--protocol", "http2",
        "--url", "http://localhost:8000",
        "--logfile", TUNNEL_LOG
    ]
    try:
        creationflags = 0
        if sys.platform == "win32":
            creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(cmd, creationflags=creationflags, close_fds=True)
        logger.info("[WATCHDOG] Spawned fresh cloudflared tunnel process.")
    except Exception as e:
        logger.error(f"[WATCHDOG] Failed to spawn cloudflared: {e}")
        return None

    # 4. Wait for new URL to appear
    new_url = None
    for attempt in range(1, 20):
        time.sleep(2)
        new_url = find_active_tunnel_url()
        if new_url:
            logger.info(f"[WATCHDOG] Discovered new tunnel URL: {new_url}")
            break
            
    return new_url

def register_url(endpoint: str, url: str) -> bool:
    payload = json.dumps({"tunnel_url": url}).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "BleSense-TunnelRegister/1.0"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            if res.status in (200, 201):
                return True
    except urllib.error.HTTPError as e:
        logger.warning(f"HTTP error {e.code} registering to {endpoint}")
    except Exception as e:
        logger.warning(f"Connection failed registering to {endpoint}: {e}")
    return False

def main():
    logger.info("Starting BLE Sense Cloudflare Tunnel Watchdog & Auto-Registry Daemon...")
    last_registered_url = None
    consecutive_ping_failures = 0

    # Initial discovery loop
    active_url = find_active_tunnel_url()
    if not active_url or is_tunnel_session_expired():
        active_url = restart_cloudflared()

    if active_url:
        logger.info(f"Active Cloudflare Tunnel: {active_url}")
        register_url(LOCAL_ENDPOINT, active_url)
        if register_url(RENDER_ENDPOINT, active_url):
            last_registered_url = active_url
            logger.info(f"[SUCCESS] Registered {active_url} with Render Cloud backend!")

    # Continuous watchdog and heartbeat loop
    while True:
        try:
            current_url = find_active_tunnel_url()
            expired = is_tunnel_session_expired()

            if expired or not current_url:
                logger.warning(f"[WATCHDOG] Session dead (expired={expired}, url={current_url}). Triggering self-healing restart.")
                current_url = restart_cloudflared()
                consecutive_ping_failures = 0
            else:
                # Test public health ping
                is_healthy = test_tunnel_ping(current_url)
                if not is_healthy:
                    consecutive_ping_failures += 1
                    logger.warning(f"[WATCHDOG] Tunnel health ping failed ({consecutive_ping_failures}/3)")
                    if consecutive_ping_failures >= 3:
                        logger.warning("[WATCHDOG] 3 consecutive ping failures. Restarting tunnel...")
                        current_url = restart_cloudflared()
                        consecutive_ping_failures = 0
                else:
                    consecutive_ping_failures = 0

            if current_url:
                # Keep local registry updated
                register_url(LOCAL_ENDPOINT, current_url)

                # Keep Render Cloud backend updated
                if current_url != last_registered_url:
                    logger.info(f"Tunnel URL updated: {current_url} -> Pushing to Render...")
                    if register_url(RENDER_ENDPOINT, current_url):
                        last_registered_url = current_url
                        logger.info(f"[SUCCESS] Registered {current_url} with Render Cloud backend!")
                else:
                    # Heartbeat update
                    register_url(RENDER_ENDPOINT, current_url)

        except Exception as e:
            logger.error(f"Unexpected error in watchdog loop: {e}")

        time.sleep(30)

if __name__ == "__main__":
    main()
