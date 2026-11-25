"""One-shot sounds of the rooms the thread works (2026-11-25), synthesised: struck-body modes and shaped noise, nothing recorded, nothing that
lasts, nothing like rope.   python scripts/audio_rooms.py   -> app/assets/audio/{ratch,clack,pan,pin,roll,whirr,heave}N.ogg"""
import os
import subprocess
import tempfile
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'app', 'assets', 'audio'))
SR = 44100
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s
        y[i] = s
    return y


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))


def modes(d, fs, dec, amp, jit=0.02):
    t = t_(d)
    y = np.zeros_like(t)
    for f, k, a in zip(fs, dec, amp):
        f *= 1 + rng.uniform(-jit, jit)
        y += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / k)
    return y


def knock(d, body, dec, hit=0.004, bright=3000):
    """wood: a few short low modes and the click of the blow"""
    y = modes(d, [body, body * 2.3, body * 3.9, body * 5.6], [dec, dec * 0.6, dec * 0.4, dec * 0.25], [1, .5, .3, .18], 0.05)
    n = band(rng.normal(size=len(y)), 300, bright) * np.exp(-t_(d) / hit)
    return y + n * 0.8


def at(y, x, s, g=1.0):
    i = int(s * SR)
    n = min(len(x), len(y) - i)
    if n > 0:
        y[i:i + n] += x[:n] * g


def room(y, sec=0.5, wet=0.22):
    n = int(sec * SR)
    ir = rng.normal(size=n) * np.exp(-np.arange(n) / SR / (sec / 5))
    ir = band(ir, 150, 4200)
    L = len(y) + n
    w = np.fft.irfft(np.fft.rfft(y, L) * np.fft.rfft(ir, L), L)
    w *= np.max(np.abs(y)) / (np.max(np.abs(w)) + 1e-9)
    o = np.zeros(L)
    o[:len(y)] = y
    return o * (1 - wet) + w * wet


def save(name, y, peak=0.8, tail=0.03):
    y = y / (np.max(np.abs(y)) + 1e-9) * peak
    k = int(tail * SR)
    y[-k:] *= np.linspace(1, 0, k)
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'a.wav')
        w = wave.open(p, 'wb')
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype('<i2').tobytes())
        w.close()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-c:a', 'libvorbis', '-q:a', '5', os.path.join(OUT, name + '.ogg')], check=True)
    print(name, f'{len(y) / SR:.2f}s')


for k in range(3):
    # a pawl dropping into an iron tooth
    y = np.zeros(int(0.3 * SR))
    for s, g in ((0, 1), (0.018 + 0.006 * k, 0.5)):
        at(y, knock(0.12, 520 + 60 * k, 0.02, 0.002, 6000) + modes(0.12, [1900, 2740, 4100], [.025, .02, .012], [.4, .3, .2]), s, g)
    save(f'ratch{k + 1}', room(y, 0.35, 0.18), 0.7)
    # a shuttle or a shelf of spools, wood on wood
    y = np.zeros(int(0.5 * SR))
    for i in range(2 + k % 2):
        at(y, knock(0.2, 210 + 45 * k + 30 * i, 0.035, 0.004, 2600), 0.09 * i + rng.uniform(0, 0.02), 1 / (1 + 0.7 * i))
    save(f'clack{k + 1}', room(y, 0.7, 0.25), 0.7)
    # a pan touching its neighbour: thin, dull, soon over (tin, not a bell)
    f = 690 + 130 * k
    y = modes(0.8, [f, f * 1.47, f * 2.09, f * 2.9, f * 3.7], [.16, .12, .08, .05, .03], [.6, .8, .5, .3, .2]) + band(rng.normal(size=int(.8 * SR)), 900, 5000) * np.exp(-t_(.8) / .004) * .4
    save(f'pan{k + 1}', room(y, 0.9, 0.3), 0.55)
    # a pin easing in cloth: a hair of a tick
    y = np.zeros(int(0.25 * SR))
    for i in range(1 + k):
        at(y, modes(0.06, [3100 + 400 * k, 4700, 6900], [.012, .01, .006], [.6, .4, .3]), 0.05 * i + rng.uniform(0, .02), .8 ** i)
    save(f'pin{k + 1}', room(y, 0.5, 0.35), 0.5)
    # a big wheel going over one board
    y = np.zeros(int(0.6 * SR))
    at(y, knock(0.4, 72 + 9 * k, 0.09, 0.012, 900), 0, 1)
    at(y, band(rng.normal(size=int(.5 * SR)), 60, 420) * np.hanning(int(.5 * SR)), 0, .35)
    at(y, knock(0.2, 160, 0.04, 0.006, 1500), 0.11, .3)
    save(f'roll{k + 1}', room(y, 0.8, 0.22), 0.85)
# a spindle taking up the turn: a short rising flutter that settles and stops
t = t_(0.9)
fl = 9 + 22 * t
y = band(rng.normal(size=len(t)), 700, 3400) * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(fl) / SR)) ** 3 * np.sin(np.pi * np.minimum(1, t / 0.9)) ** 0.8
y += 0.25 * np.sin(2 * np.pi * np.cumsum(150 + 160 * t) / SR) * np.exp(-((t - .45) / .25) ** 2)
save('whirr1', room(y, 0.6, 0.25), 0.55)
# the dark gathering itself, and heaving: earth and breath
for k in range(2):
    t = t_(1.8)
    y = band(rng.normal(size=len(t)), 28, 130 + 40 * k) * np.exp(-((t - .55) / .42) ** 2) * 1.4
    y += band(rng.normal(size=len(t)), 180, 700) * np.exp(-((t - .75) / .3) ** 2) * .25
    y += np.sin(2 * np.pi * (44 - 8 * t) * t) * np.exp(-((t - .5) / .35) ** 2) * .8
    save(f'heave{k + 1}', room(y, 1.4, 0.3), 0.95, 0.2)
