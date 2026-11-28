@echo off
set BASE_DIR=C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense
set BACKEND_DIR=%BASE_DIR%\backend

cd /d "%BASE_DIR%"

:: 1. Start FastAPI backend with pythonw (windowless background) if port 8000 is not already active
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% neq 0 (
    start "" pythonw -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir "%BACKEND_DIR%"
)

:: 2. Start Cloudflare Tunnel Auto-Registry Daemon (automatically manages & health-checks cloudflared.exe)
powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*auto_register_tunnel*' } | Select-Object -First 1" 2>nul | findstr ProcessId >nul
if %ERRORLEVEL% neq 0 (
    start "" pythonw "%BACKEND_DIR%\auto_register_tunnel.py"
)
