"""Spindledeep: acoustic signs of an old voice, used to cast and pick the knitter's takes (I can't listen, so these
stand in for an ear). For an elderly woman, compared with a young one, the voice is:
  * lower: median pitch drops (young adult women ~200-230 Hz, women in their eighties ~150-180 Hz)
  * unsteady: more cycle-to-cycle pitch wobble (jitter)
  * trembling: a slow 4-8 Hz tremor riding on held vowels
  * breathier / rougher: lower harmonics-to-noise ratio
age_score() folds these into one number, higher = older-sounding.

    <qwen venv>/python scripts/voice/age.py file.wav [...]     prints the measures
"""
import sys

import numpy as np


def measures(a, sr):
    import librosa
    a = np.asarray(a, np.float32)
    if a.ndim > 1:
        a = a.mean(1)
    if sr != 16000:
        a = librosa.resample(a, orig_sr=sr, target_sr=16000); sr = 16000
    hop = 160                                                   # 10 ms
    f0 = librosa.yin(a, fmin=70, fmax=420, sr=sr, frame_length=1024, hop_length=hop)
    rms = librosa.feature.rms(y=a, frame_length=1024, hop_length=hop)[0][:len(f0)]
    f0 = f0[:len(rms)]
    # voiced = loud enough and clearly periodic at the yin pitch
    per = np.zeros(len(f0))
    for k in range(len(f0)):
        s = a[k * hop: k * hop + 1024]
        if len(s) < 1024 or rms[k] < 0.02 * rms.max():
            continue
        s = s - s.mean(); r0 = float(np.dot(s, s)) + 1e-9; L = int(round(sr / f0[k]))
        if L + 4 < 1024:
            per[k] = max(float(np.dot(s[:-l], s[l:])) / r0 for l in (L - 1, L, L + 1))
    v = per > 0.45
    if v.sum() >= 20:                                         # drop octave errors (whispered or creaky frames)
        m0 = np.median(f0[v]); v &= (f0 > m0 * 0.66) & (f0 < m0 * 1.5)
    if v.sum() < 20:
        return dict(f0=0.0, jitter=0.0, tremor=0.0, hnr=30.0, voiced=0.0)
    f = f0[v]
    med = float(np.median(f))
    # jitter (frame level): relative change between neighbouring voiced frames, within voiced runs
    jit = []
    runs = []
    i = 0
    while i < len(f0):
        if v[i]:
            j = i
            while j < len(f0) and v[j]:
                j += 1
            runs.append(f0[i:j]); i = j
        else:
            i += 1
    for r in runs:
        if len(r) > 3:
            d = np.abs(np.diff(r)) / r[1:]
            jit.extend(d[d < 0.06])
    jitter = float(np.mean(jit)) if jit else 0.0
    # tremor: share of the slow pitch movement (1-15 Hz, in cents, detrended) that sits at 4-8 Hz, over runs >= 0.5 s
    tr = []
    for r in runs:
        if len(r) >= 50:
            c = 1200 * np.log2(r / np.median(r))
            c = c - np.convolve(c, np.ones(25) / 25, mode='same')    # remove intonation (slower than ~4 Hz)
            spec = np.abs(np.fft.rfft(c * np.hanning(len(c)))) ** 2
            fr = np.fft.rfftfreq(len(c), d=hop / sr)
            band = spec[(fr >= 4) & (fr <= 8)].sum(); tot = spec[(fr >= 1) & (fr <= 15)].sum() + 1e-9
            tr.append(band / tot * np.sqrt(np.mean(c ** 2)))         # weighted by how much it wobbles at all
    tremor = float(np.mean(tr)) if tr else 0.0
    # harmonics-to-noise ratio from the normalised autocorrelation at the pitch period, voiced frames
    hn = []
    fl = 640
    for k in np.where(v)[0][::3]:
        s = a[k * hop: k * hop + fl]
        if len(s) < fl:
            continue
        s = s - s.mean()
        r0 = float(np.dot(s, s)) + 1e-9
        lag = int(round(sr / f0[k]))
        if lag + 10 >= fl:
            continue
        best = max(float(np.dot(s[:-L], s[L:])) / r0 for L in range(max(2, lag - 3), lag + 4))
        best = min(max(best, 1e-3), 0.999)
        hn.append(10 * np.log10(best / (1 - best)))
    hnr = float(np.median(hn)) if hn else 30.0
    return dict(f0=round(med, 1), jitter=round(jitter, 4), tremor=round(tremor, 2), hnr=round(hnr, 2), voiced=round(float(v.mean()), 2))


def age_score(m):
    """higher = older-sounding, roughly 0 (a young woman) to 3 (a very old one). Pitch carries most of it: an old
    woman's voice sits around 150-175 Hz; below ~135 Hz the tracker is usually catching creak or a male-ish voice, so
    that is not rewarded. The tremor measure is noisy, so it only nudges."""
    f0 = m['f0']
    low = np.clip((215 - f0) / 50, -0.6, 1.0) - (np.clip((140 - f0) / 20, 0, 1.0) if f0 > 0 else 1.0)
    jit = np.clip((m['jitter'] - 0.006) / 0.004, -0.5, 1.0)
    breath = np.clip((7.8 - m['hnr']) / 2.0, -0.5, 1.0)
    trem = np.clip(m['tremor'] / 60.0, 0, 0.5)
    return float(1.6 * low + 0.6 * jit + 0.6 * breath + 0.3 * trem)


if __name__ == '__main__':
    import soundfile as sf
    for p in sys.argv[1:]:
        a, sr = sf.read(p)
        m = measures(a, sr)
        print(p.split('/')[-1].split('\\')[-1], m, 'age', round(age_score(m), 2), flush=True)
