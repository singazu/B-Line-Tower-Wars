@echo off
setlocal
cd /d "%~dp0"

echo Starting Brian Line Tower Wars...
echo.
echo Opening the game in your default browser...
echo.

powershell -ExecutionPolicy Bypass -File ".\open-game.ps1" -StartPort 5510 -MaxPortTries 20

if errorlevel 1 (
  echo.
  echo Failed to open the game. Press any key to close.
  pause > nul
)
