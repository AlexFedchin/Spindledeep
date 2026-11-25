#!/bin/bash
# the bitten ending's film: render + grade. usage: render_cut.sh [--prev=F,F,..] [shots...]   (--prev: half-size stills only)
# exposure per shot: "@shot(exposure=E)  # auto=A" in shots_cut.py (auto: fixed instead of taken from the first frame)
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
PY=scripts/art/.cache/venv/Scripts/python.exe
PREV=""; SH=""
for a in "$@"; do case $a in --prev=*) PREV=${a#--prev=};; *) SH="$SH $a";; esac; done
for s in ${SH:-C1 C2 C3 C4 C5}; do
  L=$(grep -B1 "^def $s(" scripts/cine/shots_cut.py | head -1)
  EXP=$(echo "$L" | sed -n 's/.*exposure=\([0-9.]*\)).*/\1/p'); AUT=$(echo "$L" | sed -n 's/.*auto=\([0-9.]*\).*/--auto=\1/p')
  if [ -n "$PREV" ]; then
    rm -rf scripts/cine/.cache/frames_prev/$s scripts/cine/.cache/graded_prev/$s
    for f in ${PREV//,/ }; do timeout 900 $B -b -P scripts/cine/render.py -- $s --preview --still=$f > scripts/cine/.cache/prev_$s.log 2>&1; grep -q RENDERED scripts/cine/.cache/prev_$s.log || { echo FAIL $s; grep -A9 Traceback scripts/cine/.cache/prev_$s.log; }; done
    $PY scripts/cine/post.py scripts/cine/.cache/frames_prev/$s scripts/cine/.cache/graded_prev/$s --exposure=$EXP $AUT 2>&1 | grep -v "libpng\|^post"
  else
    rm -rf scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s
    t0=$(date +%s)
    timeout 7200 $B -b -P scripts/cine/render.py -- $s > scripts/cine/.cache/full_$s.log 2>&1
    grep -q RENDERED scripts/cine/.cache/full_$s.log || { echo "FAIL $s"; grep -A6 Traceback scripts/cine/.cache/full_$s.log | head; continue; }
    $PY scripts/cine/post.py scripts/cine/.cache/frames/$s scripts/cine/.cache/graded/$s --exposure=$EXP $AUT 2>&1 | grep -v "libpng\|^post"
    echo "DONE $s $(( $(date +%s) - t0 ))s $(ls scripts/cine/.cache/graded/$s | wc -l) frames"
  fi
done
echo ALLDONE
