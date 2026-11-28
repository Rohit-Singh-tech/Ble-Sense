$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')

# 1. Start Shortcut
$StartPath = Join-Path $DesktopPath "Start BLE Server.lnk"
$StartShortcut = $WshShell.CreateShortcut($StartPath)
$StartShortcut.TargetPath = "C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense\start_server.bat"
$StartShortcut.WorkingDirectory = "C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense"
$StartShortcut.IconLocation = "C:\Windows\System32\shell32.dll,238"
$StartShortcut.Description = "Start BLE Sense Server and Tunnel in Background"
$StartShortcut.Save()
Write-Host "Created: $StartPath"

# 2. Stop Shortcut
$StopPath = Join-Path $DesktopPath "Stop BLE Server.lnk"
$StopShortcut = $WshShell.CreateShortcut($StopPath)
$StopShortcut.TargetPath = "C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense\stop_server.bat"
$StopShortcut.WorkingDirectory = "C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense"
$StopShortcut.IconLocation = "C:\Windows\System32\shell32.dll,131"
$StopShortcut.Description = "Stop BLE Sense Server and Cloudflare Tunnel"
$StopShortcut.Save()
Write-Host "Created: $StopPath"

# 3. Windows Startup Folder (Auto-start on PC boot / user logon)
$StartupPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
if (Test-Path $StartupPath) {
    Copy-Item $StartPath (Join-Path $StartupPath "Start BLE Server.lnk") -Force
    Write-Host "Auto-start enabled in Startup folder: $StartupPath"
}
