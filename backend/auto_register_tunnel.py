"""
Auto-Registration & Continuous Self-Healing Supervisor Daemon.
- Supervises FastAPI backend (Port 8000) and Cloudflare Quick Tunnel.
- If FastAPI ever crashes or stops, the supervisor automatically revives it.
- If Cloudflare terminates the ephemeral session ("Unauthorized: Tunnel not found"),
  the supervisor automatically restarts cloudflared and registers the new URL.
- Respects .stop_flag: if the user explicitly clicked "Stop BLE Server", the supervisor shuts down gracefully.
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
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
TUNNEL_LOG = os.path.join(BASE_DIR, "tunnel.log")
BACKEND_LOG = os.path.join(BASE_DIR, "backend.log")
STOP_FLAG = os.path.join(BASE_DIR, ".stop_flag")

RENDER_ENDPOINT = "https://ble-sense-rqnu.onrender.com/api/system/tunnel"
LOCAL_ENDPOINT = "http://127.0.0.1:8000/api/system/tunnel"
CLOUDFLARED_PATH = r"C:\cloudflared\cloudflared.exe"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(BASE_DIR, "tunnel_sync.log"), encoding="utf-8")
    ]
)
logger = logging.getLogger("system_supervisor")

TUNNEL_REGEX = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

def is_stop_requested() -> bool:
    return os.path.exists(STOP_FLAG)

def is_backend_healthy() -> bool:
    try:
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/system/ping",
            headers={"User-Agent": "BleSense-Supervisor/1.0"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            if res.status == 200:
                body = json.loads(res.read().decode("utf-8"))
                return body.get("ping") == "pong"
    except Exception:
        pass
    return False

def revive_backend():
    logger.warning(" [SUPERVISOR] FastAPI backend is down or unresponsive. Auto-reviving backend...")
    
    # Kill any stale zombie process on port 8000
    try:
        subprocess.run(
            'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
            shell=True, capture_output=True
        )
    except Exception:
        pass
    time.sleep(1)

    backend_log = open(BACKEND_LOG, "a", encoding="utf-8")
    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    cmd = [
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", "8000",
        "--app-dir", BACKEND_DIR
    ]
    try:
        subprocess.Popen(
            cmd,
            stdout=backend_log,
            stderr=backend_log,
            creationflags=creationflags,
            close_fds=True
        )
        logger.info(" [SUPERVISOR] Successfully spawned fresh FastAPI backend process.")
    except Exception as e:
        logger.error(f" [SUPERVISOR] Failed to revive backend: {e}")

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
    logger.warning(" [SUPERVISOR] Cloudflare tunnel expired or unresponsive. Restarting cloudflared...")
    
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
        "--url", "http://127.0.0.1:8000",
        "--logfile", TUNNEL_LOG
    ]
    try:
        creationflags = 0
        if sys.platform == "win32":
            creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(cmd, creationflags=creationflags, close_fds=True)
        logger.info("[SUPERVISOR] Spawned fresh cloudflared tunnel process.")
    except Exception as e:
        logger.error(f"[SUPERVISOR] Failed to spawn cloudflared: {e}")
        return None

    # 4. Wait for new URL to appear
    new_url = None
    for attempt in range(1, 25):
        time.sleep(2)
        new_url = find_active_tunnel_url()
        if new_url:
            logger.info(f"[SUPERVISOR] Discovered new tunnel URL: {new_url}")
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
    logger.info("Starting BLE Sense 24/7 Self-Healing Supervisor Daemon...")
    last_registered_url = None
    consecutive_ping_failures = 0
    backend_fail_count = 0

    # Ensure backend is up at startup
    if not is_backend_healthy() and not is_stop_requested():
        revive_backend()
        time.sleep(3)

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

    # Continuous 24/7 supervision loop
    while True:
        try:
            # Check if user intentionally clicked "Stop BLE Server"
            if is_stop_requested():
                logger.info("[SUPERVISOR] Stop flag detected (.stop_flag). Exiting supervisor.")
                break

            # 1. Supervise FastAPI backend on Port 8000
            if not is_backend_healthy():
                backend_fail_count += 1
                logger.warning(f"[SUPERVISOR] Backend ping failed ({backend_fail_count}/2)")
                if backend_fail_count >= 2:
                    revive_backend()
                    backend_fail_count = 0
                    time.sleep(3)
            else:
                backend_fail_count = 0

            # 2. Supervise Cloudflare Tunnel
            current_url = find_active_tunnel_url()
            expired = is_tunnel_session_expired()

            if expired or not current_url:
                logger.warning(f"[SUPERVISOR] Tunnel dead (expired={expired}, url={current_url}). Triggering self-healing restart.")
                current_url = restart_cloudflared()
                consecutive_ping_failures = 0
            else:
                is_healthy = test_tunnel_ping(current_url)
                if not is_healthy:
                    consecutive_ping_failures += 1
                    logger.warning(f"[SUPERVISOR] Tunnel health ping failed ({consecutive_ping_failures}/3)")
                    if consecutive_ping_failures >= 3:
                        logger.warning("[SUPERVISOR] 3 consecutive ping failures. Restarting tunnel...")
                        current_url = restart_cloudflared()
                        consecutive_ping_failures = 0
                else:
                    consecutive_ping_failures = 0

            if current_url:
                register_url(LOCAL_ENDPOINT, current_url)
                if current_url != last_registered_url:
                    logger.info(f"Tunnel URL updated: {current_url} -> Pushing to Render...")
                    if register_url(RENDER_ENDPOINT, current_url):
                        last_registered_url = current_url
                        logger.info(f"[SUCCESS] Registered {current_url} with Render Cloud backend!")
                else:
                    register_url(RENDER_ENDPOINT, current_url)

        except Exception as e:
            logger.error(f"Unexpected error in supervisor loop: {e}")

        time.sleep(15)

if __name__ == "__main__":
    main()
