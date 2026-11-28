@echo off
title Start BLE Sense Server
set BASE_DIR=C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense
cd /d "%BASE_DIR%"

:: Remove stop flag if present
if exist "%BASE_DIR%\.stop_flag" del /f /q "%BASE_DIR%\.stop_flag" >nul 2>&1

python "%BASE_DIR%\start_services.py"
