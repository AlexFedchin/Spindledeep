#!/bin/bash
# raw (ungraded) preview stills for checking poses: stills.sh SHOT:FRAME ...  -> .cache/frames_prev/<shot>/preview_<frame>.jpg
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
for a in "$@"; do s=${a%%:*}; f=${a##*:}
  timeout 900 $B -b --factory-startup -P scripts/cine/render.py -- $s --preview --still=$f > scripts/cine/.cache/still_$s.log 2>&1
  grep -q RENDERED scripts/cine/.cache/still_$s.log && echo "OK $s:$f" || { echo "FAIL $s"; grep -A6 Traceback scripts/cine/.cache/still_$s.log | head; }
done
