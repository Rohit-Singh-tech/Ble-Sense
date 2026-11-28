import os
import sys
import subprocess
import time
import urllib.request
import json

BASE_DIR = r"C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense"
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
PYTHON_EXE = sys.executable

def is_backend_running():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/system/ping", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False

print("=" * 55)
print("  Starting BLE Sense Background Services...")
print("=" * 55)

STOP_FLAG = os.path.join(BASE_DIR, ".stop_flag")
if os.path.exists(STOP_FLAG):
    try:
        os.remove(STOP_FLAG)
    except Exception:
        pass

# 1. Start FastAPI Backend if not already running
if not is_backend_running():
    print("[1/2] Starting FastAPI Backend on Port 8000...")
    backend_log = open(os.path.join(BASE_DIR, "backend.log"), "a", encoding="utf-8")
    DETACHED_FLAGS = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    subprocess.Popen(
        [PYTHON_EXE, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", BACKEND_DIR],
        stdout=backend_log,
        stderr=backend_log,
        creationflags=DETACHED_FLAGS,
        close_fds=True
    )
    # Wait up to 5 seconds for backend to respond
    for _ in range(10):
        time.sleep(0.5)
        if is_backend_running():
            print("      Backend is online and responding (200 OK)!")
            break
else:
    print("[1/2] FastAPI Backend is already running on Port 8000.")

# 2. Start Cloudflare Tunnel Watchdog if not already running
watchdog_script = os.path.join(BACKEND_DIR, "auto_register_tunnel.py")
watchdog_running = False
try:
    cmd_check = f'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object {{ $_.CommandLine -like \'*auto_register_tunnel*\' }} | Select-Object -First 1"'
    out = subprocess.check_output(cmd_check, shell=True, text=True, errors="ignore")
    if "ProcessId" in out:
        watchdog_running = True
except Exception:
    pass

if not watchdog_running:
    print("[2/2] Starting Cloudflare Tunnel & Watchdog Daemon...")
    tunnel_log = open(os.path.join(BASE_DIR, "tunnel_sync.log"), "a", encoding="utf-8")
    DETACHED_FLAGS = 0x00000008 | 0x00000200
    subprocess.Popen(
        [PYTHON_EXE, watchdog_script],
        stdout=tunnel_log,
        stderr=tunnel_log,
        creationflags=DETACHED_FLAGS,
        close_fds=True
    )
    print("      Tunnel Watchdog spawned in background.")
else:
    print("[2/2] Cloudflare Tunnel Watchdog is already running.")

print("=" * 55)
print("  [SUCCESS] All BLE Sense services are active!")
print("=" * 55)
time.sleep(2)
