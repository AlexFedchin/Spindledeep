"""Spindledeep: what is at the bottom, generated locally with SDXL (RealVisXL) as lit tone on pure black.

    scripts/art/.cache/venv/Scripts/python.exe scripts/art/caller.py [shots...] [--seeds N] [--seed S]
Candidates: .cache/out/caller/<shot>_<seed>.png. cutout.py turns the picks into sprites (tone + alpha).
"""
import argparse
import os
import sys
import time

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from generate import load, OUT  # noqa: E402

STYLE = ('black and white photograph, pitch black background, single dim light, extreme chiaroscuro, found photograph from 1890, '
         'photorealistic skin texture, horror, dread, unsettling, film grain')
NEG = ('color, text, watermark, logo, frame, border, cartoon, anime, cgi, 3d render, painting, gore, blood, smiling, makeup, '
       'bright background, grey background, clothes pattern, modern, lowres, blurry, zombie, skull, vampire, monster teeth, fangs')

SHOTS = {
    # the thing itself: a face that has only ever learned to call
    'face': ('extreme close-up of an impossibly long pale human face with no eyes, smooth blank skin where the eyes should be, '
             'no nose, huge open black mouth stretched far too wide in a silent call, emerging from total darkness', 832, 1216),
    'faceshut': ('extreme close-up of an impossibly long pale hairless human face with no eyes, smooth blank skin where the eyes should be, '
                 'thin closed mouth, head tilted as if listening, emerging from total darkness', 832, 1216),
    'bend': ('a gigantic emaciated naked hairless pale humanoid with extremely long thin limbs and long neck, crouching and bending down out of '
             'the darkness toward the viewer, face hidden in shadow, total darkness', 1216, 832),
    'tall': ('full body of an impossibly tall emaciated pale humanoid figure with arms hanging down to its ankles, standing perfectly still in '
             'total darkness, head bowed, no face, long thin legs', 640, 1536),
    # the called: people who came when they heard their names
    'back': ('full body of one barefoot villager in a long pale linen nightgown standing perfectly still seen from behind, back turned to the camera, '
             'arms hanging straight down, head slightly bowed, wet hair, total darkness', 640, 1536),
    'front': ('full body of one barefoot villager in a long pale linen nightgown standing perfectly still facing the camera, arms hanging straight '
              'down, head tilted far back, mouth stretched wide open, eyes closed, total darkness', 640, 1536),
    'backman': ('full body of one barefoot old man in a long pale nightshirt standing perfectly still seen from behind, back turned to the camera, '
                'arms hanging straight down, total darkness', 640, 1536),
    'frontman': ('full body of one barefoot old man in a long pale nightshirt standing perfectly still facing the camera, arms hanging straight '
                 'down, face hidden in black shadow, mouth wide open, total darkness', 640, 1536),
    # hands
    'offer': ('one very long emaciated pale arm reaching out of total darkness from the left side, palm up, impossibly long thin bony fingers, '
              'offering, side view', 1216, 832),
    'reach': ('many long pale emaciated human arms and hands reaching upward out of total darkness, long thin fingers spread, crowded together', 1216, 832),
    'wallhands': ('dozens of pale human hands pressing out of black earth, dirt, long thin fingers, reaching, total darkness', 1216, 832),
    'lip': ('extremely long thin pale bony fingers gripping over the edge of a stone well from inside, at night, snow on the stones, total darkness', 1216, 832),
}

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('shots', nargs='*')
    ap.add_argument('--seeds', type=int, default=4)
    ap.add_argument('--seed', type=int, default=31)
    a = ap.parse_args()
    pipe = load('realvis')
    os.makedirs(os.path.join(OUT, 'caller'), exist_ok=True)
    for s in a.shots or list(SHOTS):
        prompt, w, h = SHOTS[s]
        for k in range(a.seeds):
            path = os.path.join(OUT, 'caller', f'{s}_{a.seed + k}.png')
            if os.path.exists(path):
                continue
            t0 = time.time()
            img = pipe(prompt, prompt_2=prompt + ', ' + STYLE, negative_prompt=NEG, width=w, height=h, num_inference_steps=30,
                       guidance_scale=5.5, generator=torch.Generator('cpu').manual_seed(a.seed + k)).images[0]
            img.convert('L').save(path)
            print(s, a.seed + k, f'{time.time() - t0:.1f} s', flush=True)
