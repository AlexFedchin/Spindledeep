#!/bin/bash
# full render + grade of every shot, then the two edits. usage: render_all.sh [shots...]
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
PY=scripts/art/.cache/venv/Scripts/python.exe
SH=${@:-E2 E3 E4 E5 E6 E7}
for s in $SH; do
  EXP=$($PY -c "import re;src=open('scripts/cine/shots.py').read();m=re.search(r'@shot\(exposure=([\d.]+)\)\ndef $s\(',src);print(m.group(1))")
  rm -rf scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s
  t0=$(date +%s)
  timeout 7200 $B -b -P scripts/cine/render.py -- $s > scripts/cine/.cache/full_$s.log 2>&1
  grep -q RENDERED scripts/cine/.cache/full_$s.log || { echo "FAIL $s"; grep -A6 Traceback scripts/cine/.cache/full_$s.log | head; continue; }
  $PY scripts/cine/post.py scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s --exposure=$EXP 2>&1 | grep -v "libpng\|^post"
  echo "DONE $s $(( $(date +%s) - t0 ))s $(ls scripts/cine/.cache/graded/$s | wc -l) frames"
done
echo ALLDONE
