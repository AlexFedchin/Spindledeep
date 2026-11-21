@echo off
REM Spindledeep - build Windows executables into release\ (portable .exe + installer).
cd /d "%~dp0"
if not exist node_modules\electron-builder ( call npm install --no-audit --no-fund || goto :error )
call npx electron-builder --win portable nsis --x64 --publish never || goto :error
echo.
echo Done. See the release folder:
dir /b release\*.exe
pause
goto :eof
:error
echo Build failed.
pause
