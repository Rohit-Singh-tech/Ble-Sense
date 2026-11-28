@echo off
title Stop BLE Sense Server
set BASE_DIR=C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense
echo ===================================================
echo Stopping BLE Sense Server and Cloudflare Tunnel...
echo ===================================================

:: Set stop flag so supervisor does not auto-restart
type nul > "%BASE_DIR%\.stop_flag"

:: 1. Terminate process listening on port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo Stopping Backend PID: %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Terminate Cloudflare Tunnel
echo Stopping Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe >nul 2>&1

:: 3. Terminate Supervisor
echo Stopping Supervisor...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*auto_register_tunnel*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo ===================================================
echo [SUCCESS] BLE Sense backend and tunnel are stopped.
echo ===================================================
ping 127.0.0.1 -n 3 >nul
