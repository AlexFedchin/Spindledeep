#!/usr/bin/env sh
# Spindledeep - play from source (needs Node.js 20+)
cd "$(dirname "$0")"
[ -x node_modules/electron/dist/electron ] || [ -f node_modules/electron/dist/electron.exe ] || npm install --no-audit --no-fund
unset ELECTRON_RUN_AS_NODE
exec npx electron .
