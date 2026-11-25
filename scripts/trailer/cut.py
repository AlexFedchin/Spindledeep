"""Cut the trailer from capture.py's clips.   <art venv>/python scripts/trailer/cut.py <dir>   -> release/Spindledeep-trailer.mp4 (1080p30)
Nothing of the plot is in it: places, the thread, the chase, the name. The music (Kevin MacLeod, CC BY) is credited on the last card."""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

D = sys.argv[1]
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
F = os.path.join(ROOT, 'app', 'assets', 'fonts')
A = os.path.join(ROOT, 'app', 'assets', 'audio')
OUT = os.path.join(ROOT, 'release', 'Spindledeep-trailer.mp4')
INK, PAPER, RED = (11, 10, 16), (232, 220, 196), (216, 38, 44)


def card(name, big=None, small=None, foot=None, size=76):
    im = Image.new('RGB', (1920, 1080), INK)
    d = ImageDraw.Draw(im)
    sc = ImageFont.truetype(os.path.join(F, 'IMFeENsc28P.ttf'), size)
    it = ImageFont.truetype(os.path.join(F, 'IMFeENit28P.ttf'), 46)
    ft = ImageFont.truetype(os.path.join(F, 'IMFeENit28P.ttf'), 27)
    y = 500
    if big:
        sp = size * 0.14
        w = sum(sc.getlength(c) + sp for c in big) - sp
        x = (1920 - w) / 2
        for c in big:
            d.text((x, y - size / 2), c, font=sc, fill=PAPER)
            x += sc.getlength(c) + sp
    if small:
        w = it.getlength(small)
        d.text(((1920 - w) / 2, y + ((165 if size > 100 else 95) if big else -20)), small, font=it, fill=(190, 178, 156))
    if big and size > 100:
        g = Image.new('RGB', im.size, (0, 0, 0))
        ImageDraw.Draw(g).line([(760, y + 128), (1160, y + 128)], fill=RED, width=4)
        g = g.filter(ImageFilter.GaussianBlur(9))
        im = Image.fromarray(__import__('numpy').clip(__import__('numpy').asarray(im, int) + __import__('numpy').asarray(g, int) * 2, 0, 255).astype('uint8'))
        ImageDraw.Draw(im).line([(760, y + 128), (1160, y + 128)], fill=RED, width=2)
        d = ImageDraw.Draw(im)
    for k, t in enumerate(foot or []):
        d.text(((1920 - ft.getlength(t)) / 2, 930 + k * 38), t, font=ft, fill=(140, 130, 114))
    im.save(os.path.join(D, name + '.png'))


card('k1', small='Every winter, something calls up the well.')
card('k2', small='She made you from everything she loved, and one red thread.')
card('k3', small='It is your rope, your lamp, and the only way home.')
card('k4', small='Something is following it.')
card('title', 'Spindledeep', 'a descent on a single red thread', ['Music: Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0'], 150)
# (clip, from, seconds) or (card, seconds)
SEQ = [('k1', 3.0), ('brink', 0.9, 4.0), ('throat', 0.6, 3.2), ('k2', 3.2), ('gardens', 1.0, 3.6), ('gallery', 0.8, 4.4), ('mere', 0.8, 4.2), ('k3', 3.2), ('hall', 0.7, 2.8), ('weigh', 1.2, 4.6),
       ('tread', 0.9, 3.4), ('bobbin', 0.8, 3.6), ('hush', 1.6, 3.6), ('k4', 2.6), ('loom1', 0.7, 6.0), ('loom2', 0.7, 5.4), ('title', 6.0)]
run = lambda *a: subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *a], check=True)
parts, t, sounds = [], 0.0, []
for i, s in enumerate(SEQ):
    out = os.path.join(D, f'p{i:02}.mp4')
    secs = s[-1]
    fade = f'fade=t=in:d=0.35,fade=t=out:st={secs - 0.35}:d=0.35' if len(s) == 2 else 'fade=t=in:d=0.12,fade=t=out:st=%g:d=0.12' % (secs - 0.12)
    if len(s) == 2:
        run('-loop', '1', '-t', str(secs), '-i', os.path.join(D, s[0] + '.png'), '-vf', f'{fade},format=yuv420p', '-r', '30', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out)
    else:
        src = os.path.join(D, s[0] + '.webm')
        run('-i', src, '-an', '-vf', f'fps=30,trim=start={s[1]}:duration={secs},setpts=PTS-STARTPTS,crop=ih*16/9:ih,scale=1920:1080:flags=lanczos,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2,trim=0:{secs},{fade},format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', out)
        w = os.path.join(D, f's{i:02}.wav')
        try:
            run('-ss', str(s[1]), '-i', src, '-t', str(secs), '-vn', '-ac', '2', '-ar', '48000', '-af', f'afade=t=in:d=0.2,afade=t=out:st={secs - 0.25}:d=0.25', w)
            sounds.append((w, t))
        except subprocess.CalledProcessError:
            print('no sound in', s[0])
    parts.append(out)
    t += secs
open(os.path.join(D, 'list.txt'), 'w').write(''.join(f"file '{p}'\n" for p in parts))
run('-f', 'concat', '-safe', '0', '-i', os.path.join(D, 'list.txt'), '-c', 'copy', os.path.join(D, 'v.mp4'))
ins, filt, names = [], [], []
for k, (w, at) in enumerate(sounds):
    ins += ['-i', w]
    filt.append(f'[{k}]adelay={int(at * 1000)}|{int(at * 1000)},volume=1.5[a{k}]')
    names.append(f'[a{k}]')
k = len(sounds)
chase = sum(s[-1] for s in SEQ[:13])
for j, (f, at, vol, flt) in enumerate([('mus_gallery', 2.0, 0.55, f'afade=t=in:d=3,afade=t=out:st={chase - 4.5}:d=3'), ('heave1', chase + 0.4, 0.9, 'anull'), ('thud', t - 6.0, 0.9, 'anull'), ('mus_title', t - 5.4, 0.5, 'afade=t=in:d=1.5,afade=t=out:st=3.4:d=2')]):
    ins += ['-i', os.path.join(A, f + '.ogg')]
    filt.append(f'[{k + j}]{flt},volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[m{j}]')
    names.append(f'[m{j}]')
run(*ins, '-filter_complex', ';'.join(filt) + f';{"".join(names)}amix=inputs={len(names)}:normalize=0:duration=longest,loudnorm=I=-17:TP=-1.5,atrim=0:{t},afade=t=out:st={t - 1.6}:d=1.6[o]', '-map', '[o]', '-ar', '48000', os.path.join(D, 'a.wav'))
run('-i', os.path.join(D, 'v.mp4'), '-i', os.path.join(D, 'a.wav'), '-c:v', 'libx264', '-crf', '25', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', OUT)
print(OUT, f'{t:.1f} s', os.path.getsize(OUT) // 1024 // 1024, 'MB')
