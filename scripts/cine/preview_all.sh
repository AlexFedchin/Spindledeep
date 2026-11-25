#!/bin/bash
# preview a still of every shot (half res) and grade it; usage: preview_all.sh [shots...]
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
PY=scripts/art/.cache/venv/Scripts/python.exe
SH=${@:-E1 E2 E3 E4 E5 E6 E7}
for s in $SH; do
  F=$($PY -c "import re;src=open('scripts/cine/shots.py').read();import sys
m=re.search(r'def $s\(out, preview\):.*?new_scene\((\d+)',src,re.S);print(int(m.group(1))*2//3)")
  EXP=$($PY -c "import re;src=open('scripts/cine/shots.py').read();m=re.search(r'@shot\(exposure=([\d.]+)\)\ndef $s\(',src);print(m.group(1) if m else 1)")
  rm -rf scripts/cine/.cache/frames_prev/$s scripts/cine/.cache/graded_prev/$s; timeout 900 $B -b -P scripts/cine/render.py -- $s --preview --still=$F > scripts/cine/.cache/prev_$s.log 2>&1
  grep -q RENDERED scripts/cine/.cache/prev_$s.log || { echo "FAIL $s"; grep -A5 Traceback scripts/cine/.cache/prev_$s.log | head -12; continue; }
  $PY scripts/cine/post.py scripts/cine/.cache/frames_prev/$s scripts/cine/.cache/graded_prev/$s --exposure=$EXP 2>&1 | grep -v libpng
  echo "OK $s f$F"
done
