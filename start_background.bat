@echo off
set BASE_DIR=C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense
set BACKEND_DIR=%BASE_DIR%\backend

cd /d "%BASE_DIR%"

:: 1. Start FastAPI backend if not already running on port 8000
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% neq 0 (
    start /B "" python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir "%BACKEND_DIR%" > "%BASE_DIR%\backend.log" 2>&1
)

:: 2. Start Cloudflare Tunnel if not already running
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | findstr /I "cloudflared.exe" >nul
if %ERRORLEVEL% neq 0 (
    start /B "" "C:\cloudflared\cloudflared.exe" tunnel --protocol http2 --url http://localhost:8000 --logfile "%BASE_DIR%\tunnel.log"
)

:: 3. Start Cloudflare Tunnel Auto-Registry Daemon if not already running
wmic process where "caption='python.exe' and commandline like '%%auto_register_tunnel%%'" get processid 2>nul | findstr [0-9] >nul
if %ERRORLEVEL% neq 0 (
    start /B "" python "%BACKEND_DIR%\auto_register_tunnel.py" > "%BASE_DIR%\tunnel_sync.log" 2>&1
)
