@echo off
echo Stopping background BLE Sense servers...

:: Stop Cloudflare Tunnel
taskkill /F /IM cloudflared.exe 2>nul

:: Stop auto_register_tunnel daemon
for /f "tokens=2 delims=," %%i in ('wmic process where "caption='python.exe' and commandline like '%%auto_register_tunnel%%'" get processid /format:csv 2>nul ^| findstr /r "[0-9]"') do (
    taskkill /F /PID %%i 2>nul
)

:: Stop any process listening on port 8000 (FastAPI / uvicorn)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)

echo.
echo All background servers and sync daemons have been stopped.
timeout /t 3
