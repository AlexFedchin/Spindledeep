@echo off
REM Spindledeep - build Windows executables into release\ (portable .exe + installer).
cd /d "%~dp0"
REM every build is a new version (1.1.0, 1.1.1, ...); "build.cmd same" keeps the number. To sign the exe so Windows does not warn,
REM set CSC_LINK (a .pfx code-signing certificate) and CSC_KEY_PASSWORD first: electron-builder picks them up.
if /i not "%~1"=="same" call npm version patch --no-git-tag-version >nul
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
