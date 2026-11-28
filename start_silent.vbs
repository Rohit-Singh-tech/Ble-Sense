Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c """ & "C:\Users\1239\Desktop\Ble Sense Dashboard\Ble-Sense\start_background.bat" & """", 0, False
Set WshShell = Nothing
