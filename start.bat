@echo off
REM تشغيل Au2Ka كاملًا بنقرة واحدة أو بأمر واحد من التيرمنال:
REM     start.bat
REM التفاصيل في scripts\start-local.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
if errorlevel 1 pause
