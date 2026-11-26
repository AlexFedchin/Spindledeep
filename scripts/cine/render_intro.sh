#!/bin/bash
# the films (prologue and endings): render + grade at full size. usage: render_intro.sh [shots...]   (stills: pv.sh; contact: touch.py)
# exposure per shot: "@shot(exposure=E)  # auto=A" in shots_intro.py (auto: fixed instead of taken from the first frame)
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
PY=scripts/art/.cache/venv/Scripts/python.exe
for s in ${@:-I1 I2 I2K I3 I4 I5 I5S I6 I7 I8 I9}; do
  L=$(grep -hB1 "^def $s(" scripts/cine/shots_intro.py scripts/cine/shots_end.py | head -1)
  EXP=$(echo "$L" | sed -n 's/.*exposure=\([0-9.]*\)).*/\1/p'); AUT=$(echo "$L" | sed -n 's/.*auto=\([0-9.]*\).*/--auto=\1/p')
  SOF=$(echo "$L" | sed -n 's/.*soft=\([0-9.]*\).*/--soft=\1/p')
  rm -rf scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s
  t0=$(date +%s)
  timeout 7200 $B -b --factory-startup -P scripts/cine/render.py -- $s > scripts/cine/.cache/full_$s.log 2>&1
  grep -q RENDERED scripts/cine/.cache/full_$s.log || { echo "FAIL $s"; grep -A6 Traceback scripts/cine/.cache/full_$s.log | head; continue; }
  $PY scripts/cine/post.py scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s --exposure=$EXP $AUT $SOF --wobble=0.3 2>&1 | grep -v "libpng\|^post"
  echo "DONE $s $(( $(date +%s) - t0 ))s $(ls scripts/cine/.cache/graded/$s | wc -l) frames"
done
echo ALLDONE
