"""Spindledeep: score the recorded takes with Whisper and build the shipped voice files.

Score = word accuracy against the script (dominant) + a pacing term (slow, unhurried delivery is wanted).
The winner goes through a gentle chain (high-pass, warmth, a touch of cave room) to app/assets/voice/<id>.ogg.
    <qwen venv>/python scripts/voice/pick.py
"""
import difflib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from lines import LINES  # noqa: E402

RAW = os.path.join(HERE, '.cache', 'raw')
MODELS = os.environ.get('QWEN_MODELS', os.path.join(HERE, '.cache', 'models'))
OUT = os.path.join(ROOT, 'app', 'assets', 'voice')


def words(t):
    return re.sub(r"[^a-z' ]", ' ', t.lower().replace('colour', 'color')).split()


def main():
    import whisper
    import soundfile as sf
    asr = whisper.load_model(os.path.join(MODELS, 'whisper', 'large-v3-turbo.pt'), device='cuda')
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for lid, (text, _) in LINES.items():
        best = None
        ref = words(text)
        for f in sorted(os.listdir(RAW)):
            if not re.fullmatch(lid + r'_\d+\.wav', f):
                continue
            p = os.path.join(RAW, f)
            a, sr = sf.read(p)
            dur = len(a) / sr
            hyp = words(asr.transcribe(p, language='en')['text'])
            acc = difflib.SequenceMatcher(None, ref, hyp).ratio()
            wps = len(ref) / max(dur, 0.1)
            pace = 1 - min(1, abs(wps - 2.1) / 2.0)          # ~2.1 words/s: slow and tender
            score = acc * 0.8 + pace * 0.2
            report.setdefault(lid, []).append({'take': f, 'acc': round(acc, 3), 'wps': round(wps, 2), 'score': round(score, 3)})
            if best is None or score > best[0]:
                best = (score, p)
        if not best:
            continue
        out = os.path.join(OUT, lid + '.ogg')
        chain = ('highpass=f=80,lowpass=f=11000,equalizer=f=220:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=-1.5,'
                 'acompressor=threshold=-22dB:ratio=2.5:attack=8:release=200,'
                 'aecho=0.8:0.5:60|110:0.10|0.06,loudnorm=I=-17:TP=-2:LRA=9,apad=pad_dur=0.4')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', best[1], '-af', chain, '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5', out], check=True)
        print(lid, 'picked', os.path.basename(best[1]), round(best[0], 3), flush=True)
    json.dump(report, open(os.path.join(HERE, '.cache', 'scores.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
