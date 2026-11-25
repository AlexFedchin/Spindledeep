#!/bin/bash
# half-size engraved stills of a prologue shot in one sheet: pv.sh SHOT f,f,f [columns] [--raw]  -> .cache/pv/<shot>.jpg
cd "$(dirname "$0")/../.."
B=scripts/cine/.cache/blender-4.2.3-windows-x64/blender.exe
PY=scripts/art/.cache/venv/Scripts/python.exe
s=$1; C=scripts/cine/.cache; mkdir -p $C/pv
rm -rf $C/frames_prev/$s $C/graded_prev/$s
$B -b --factory-startup -P scripts/cine/render.py -- $s --preview --stills=$2 > $C/pv_$s.log 2>&1
grep -q RENDERED $C/pv_$s.log || { echo FAIL $s; grep -A12 Traceback $C/pv_$s.log | head -30; exit 1; }
EXP=$(grep -hB1 "^def $s(" scripts/cine/shots_intro.py scripts/cine/shots_end.py | sed -n 's/.*exposure=\([0-9.]*\)).*/\1/p'); AUT=$(grep -hB1 "^def $s(" scripts/cine/shots_intro.py scripts/cine/shots_end.py | sed -n 's/.*auto=\([0-9.]*\).*/--auto=\1/p')
$PY scripts/cine/post.py $C/frames_prev/$s $C/graded_prev/$s --exposure=$EXP $AUT --wobble=0.3 2>&1 | grep -v "libpng\|^post"
D=$C/graded_prev/$s; X=png; [ "$4" = "--raw" ] && { D=$C/frames_prev/$s; X=jpg; }
$PY - "$D" "$X" $C/pv/$s.jpg ${3:-2} <<'P'
import sys,glob,os
from PIL import Image
d,x,o,c=sys.argv[1:]; c=int(c)
fs=sorted(glob.glob(d+'/'+('preview_*.jpg' if x=='jpg' else '*.png'))); w=1920//c; h=w*9//16
im=Image.new('RGB',(w*c,h*((len(fs)+c-1)//c)))
for i,f in enumerate(fs): im.paste(Image.open(f).convert('RGB').resize((w,h),Image.LANCZOS),((i%c)*w,(i//c)*h))
im.save(o,quality=88)
P
grep "REPORT" $C/pv_$s.log; echo OK $s
