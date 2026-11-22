"""Spindledeep: choose the knitter's takes and build the shipped voice files.

Every take in .cache/raw (record.py: design `_d*` and clone `_c*`) is scored on
  * words: Whisper large-v3-turbo against the script (dominant: a wrong word loses outright)
  * likeness: speaker-embedding similarity to the cast reference (.cache/cast/ref.wav), so all lines are one woman
  * age: age.py's measure (lower pitch, wobble, breath), so she sounds old
  * pace: slow and unhurried (~2 words/s)
The winner gets a light ageing touch (a hair lower, a slow 5 Hz tremor), then the old cave chain; `WRONG` lines also
get the lower second voice under hers. Output: app/assets/voice/<id>.ogg; .cache/scores.json keeps every score.
    <qwen venv>/python scripts/voice/pick.py
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from lines import LINES, WRONG  # noqa: E402
from age import measures, age_score  # noqa: E402

RAW = os.path.join(HERE, '.cache', 'raw')
CAST = os.path.join(HERE, '.cache', 'cast')
MODELS = os.environ.get('QWEN_MODELS', os.path.join(HERE, '.cache', 'models'))
OUT = os.path.join(ROOT, 'app', 'assets', 'voice')
AGE_FX = 'asetrate=24000*0.97,aresample=24000,atempo=1.0309'   # a hair lower (~ -0.5 semitone); the tremor is added in numpy
# (ffmpeg's vibrato filter followed by loudnorm intermittently blew up into full-scale noise)
CHAIN = ('highpass=f=80,lowpass=f=10500,equalizer=f=220:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=-2,'
         'acompressor=threshold=-22dB:ratio=2.5:attack=8:release=200,'
         'aecho=0.8:0.5:60|110:0.10|0.06,loudnorm=I=-17:TP=-2:LRA=9,apad=pad_dur=0.4')


def words(t):
    t = t.lower().replace('colour', 'color').replace('grey', 'gray').replace("'", '')
    t = t.replace('70', ' seventy ')                                 # Whisper writes numbers as digits
    return re.sub(r'[^a-z ]', ' ', t).split()


def resample(a, sr, to):
    from scipy import signal
    from math import gcd
    g = gcd(sr, to)
    return signal.resample_poly(a, to // g, sr // g).astype(np.float32) if sr != to else a.astype(np.float32)


def tremble(a, sr, rate=5.2, cents=22.0, amp=0.07):
    """an old voice's tremor: a slow pitch wobble (a modulated delay line, ±`cents`) and a matching small swell in level"""
    a = np.asarray(a, np.float64)
    n = np.arange(len(a))
    dev = 2 ** (cents / 1200) - 1                                   # relative pitch deviation at the peak
    A = dev * sr / (2 * np.pi * rate)                               # delay swing (samples) that gives it
    ramp = np.clip(n / (0.4 * sr), 0, 1)                            # fade the tremor in so the first consonant stays crisp
    d = A * ramp * (1 + np.sin(2 * np.pi * rate * n / sr + 0.7)) + 2
    x = np.clip(n - d, 0, len(a) - 1.001)
    i = np.floor(x).astype(int); fr = x - i
    y = a[i] * (1 - fr) + a[i + 1] * fr
    y *= 1 - amp * ramp * (0.5 + 0.5 * np.sin(2 * np.pi * rate * n / sr))
    return y.astype(np.float32)


def not_noise(path):
    """speech normalised to -17 LUFS sits near 0.1 RMS; the broken files were 0.4-0.7 (full-scale noise)"""
    a, sr = sf.read(path)
    return float(np.sqrt(np.mean(np.asarray(a, np.float64) ** 2))) < 0.3


def main():
    import whisper
    asr = whisper.load_model(os.path.join(MODELS, 'whisper', 'large-v3-turbo.pt'), device='cuda')
    from qwen_tts import Qwen3TTSModel
    base = Qwen3TTSModel.from_pretrained(os.path.join(MODELS, 'Qwen3-TTS-12Hz-1.7B-Base'), device_map='cpu', dtype=torch.float32)
    ssr = base.model.speaker_encoder_sample_rate

    def emb(a, sr):
        with torch.no_grad():
            e = base.model.extract_speaker_embedding(audio=resample(np.asarray(a, np.float32), sr, ssr), sr=ssr)
        e = e.detach().float().cpu().numpy().reshape(-1)
        return e / (np.linalg.norm(e) + 1e-9)
    ra, rsr = sf.read(os.path.join(CAST, 'ref.wav'))
    ref_e = emb(ra, rsr)
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for lid, (text, _) in LINES.items():
        ref = words(text)
        best = None
        for f in sorted(os.listdir(RAW)):
            if not re.fullmatch(lid + r'_[dc]\d+\.wav', f):
                continue
            p = os.path.join(RAW, f)
            a, sr = sf.read(p)
            dur = len(a) / sr
            acc = difflib.SequenceMatcher(None, ref, words(asr.transcribe(p, language='en')['text'])).ratio()
            m = measures(a, sr)
            ag = age_score(m)
            sim = float(np.dot(emb(a, sr), ref_e))
            wps = len(ref) / max(dur, 0.1)
            pace = 1 - min(1, abs(wps - 2.1) / 2.0)
            words_term = 4.0 if acc >= 0.97 else (4.0 * acc - 2.0)    # any misread word costs more than age can win back
            score = words_term + 1.5 * sim + 0.9 * ag + 1.5 * pace      # pace stands in for the slow, acted delivery
            r = {'take': f, 'acc': round(acc, 3), 'sim': round(sim, 3), 'age': round(ag, 2), **m, 'wps': round(wps, 2), 'score': round(score, 3)}
            report.setdefault(lid, []).append(r)
        ranked = sorted(report.get(lid, []), key=lambda r: -r['score'])
        if not ranked:
            continue
        out = os.path.join(OUT, lid + '.ogg')
        need = 0.95 if lid in WRONG else 0.99         # the lines with a second voice under hers may blur a word
        for r in ranked[:6]:
            # a hurried take is eased back toward ~2.4 words/s (at most 15 % slower): she is old and in no rush
            slow = max(0.85, min(1.0, 2.4 / r['wps']))
            fx = AGE_FX + (f',atempo={slow:.3f}' if slow < 0.999 else '')
            r['slowed'] = round(slow, 3)
            src = os.path.join(HERE, '.cache', f'_trem_{lid}.wav')
            a, sr = sf.read(os.path.join(RAW, r['take']))
            sf.write(src, tremble(a, sr), sr)
            if lid in WRONG:
                w = WRONG[lid]
                graph = (f'[0]{fx},asplit=2[a][b];[b]asetrate=24000*0.667,aresample=24000,atempo=1.5,adelay=35,lowpass=f=2400[lo];'
                         f'[a][lo]amix=inputs=2:weights=1 {w}:normalize=0,{CHAIN}[out]')
                cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src, '-filter_complex', graph, '-map', '[out]']
            else:
                cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', fx + ',' + CHAIN]
            subprocess.run(cmd + ['-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5', out], check=True)
            os.remove(src)
            if not not_noise(out):
                print(lid, r['take'], 'came out as noise, next take', flush=True); continue
            # the finished file must still say every word: the ageing can blur a consonant on some takes
            final = difflib.SequenceMatcher(None, ref, words(asr.transcribe(out, language='en')['text'])).ratio()
            r['final_acc'] = round(final, 3)
            if final >= need:
                print(lid, 'picked', r, flush=True)
                break
            print(lid, r['take'], 'lost a word after ageing', final, '- next take', flush=True)
        else:
            raise SystemExit(f'{lid}: no take survived the ageing with every word intact')
    json.dump(report, open(os.path.join(HERE, '.cache', 'scores.json'), 'w', encoding='utf-8'), indent=1)


if __name__ == '__main__':
    main()
