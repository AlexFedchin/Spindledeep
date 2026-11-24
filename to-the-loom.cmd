@echo off
rem Opens Spindledeep with "Go to the Loom" on the title menu (starts at the pole where you come into it).
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
start "" node_modules\electron\dist\electron.exe . --from=23
