@echo off
REM Spindledeep - play from source (needs Node.js 20+). First run installs Electron.
cd /d "%~dp0"
if not exist node_modules\electron\dist\electron.exe (
  echo Installing dependencies...
  call npm install --no-audit --no-fund || goto :error
)
set ELECTRON_RUN_AS_NODE=
call npx electron .
goto :eof
:error
echo.
echo Setup failed. Make sure Node.js 20 or newer is installed: https://nodejs.org
pause
