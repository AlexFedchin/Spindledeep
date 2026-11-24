"""Spindledeep: the face at the bottom. Takes a generated portrait (caller.py faceshut_31), closes skin over the eyes, pulls
the head long, and opens the mouth far too wide in steps; each step is settled by a light SDXL image-to-image pass.
    scripts/art/.cache/venv/Scripts/python.exe scripts/art/facework.py   -> .cache/out/caller/call_0..5.png"""
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
D = os.path.join(HERE, '.cache', 'out', 'caller')


def blob(h, w, cx, cy, rx, ry, p=2.0):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    return np.clip(1.6 - 1.6 * (np.abs((x - cx) / rx) ** p + np.abs((y - cy) / ry) ** p), 0, 1)


def skin_over(g):
    """no eyes: each socket becomes the low-frequency shading of the face around it, with skin grain"""
    h, w = g.shape
    out = g.copy()
    rng = np.random.default_rng(2)
    grain = g - cv2.GaussianBlur(g, (0, 0), 3)
    for cx, cy, rx, ry in ((225, 400, 175, 135), (628, 396, 175, 135)):
        m = blob(h, w, cx, cy, rx, ry)
        hard = (m > 0.02).astype(np.uint8) * 255
        fill = cv2.inpaint((np.clip(out, 0, 1) * 255).astype(np.uint8), hard, 5, cv2.INPAINT_TELEA).astype(np.float32) / 255
        fill = cv2.GaussianBlur(fill, (0, 0), 22)
        # a shallow hollow where the socket is, and grain borrowed from the forehead
        y, x = np.mgrid[0:h, 0:w].astype(np.float32)
        fill *= 1 - 0.28 * np.exp(-(((x - cx) / 90) ** 2 + ((y - cy) / 62) ** 2))
        src = np.roll(grain, (cy - 190, cx - 420), (0, 1))
        out = out * (1 - m) + (fill + src * 0.9 + rng.normal(0, 0.006, g.shape)) * m
    return np.clip(out, 0, 1)


def open_mouth(g, o):
    """jaw dropped by o * 330 px; the gap is black, the cheeks are dragged down and in"""
    h, w = g.shape
    H = h + 420
    ym, xm = 822, 440
    y, x = np.mgrid[0:H, 0:w].astype(np.float32)
    drop = 360 * o
    half = 150 * (1 - 0.12 * o)
    # lips: upper edge rises a touch, lower edge falls; an almond that goes tall
    u = np.clip(np.abs(x - xm) / half, 0, 1)
    k = np.sqrt(1 - u ** 2)
    top = ym - 26 * o * k
    bot = ym + drop * k
    # inverse map: where does each output pixel come from
    fall = np.exp(-(((x - xm) / 330) ** 2))                 # the drag on the skin, widest at the chin
    below = np.clip((y - ym) / (drop + 1e-3), 0, 1)
    sy = np.where(y > bot, y - drop * fall * np.where(x * 0 + 1 > 0, 1, 1), y)
    sy = np.where((y > ym) & (y <= bot), ym, sy)
    sy = np.where((y > ym - 220) & (y <= ym), y + 26 * o * k * np.clip((y - (ym - 220)) / 220, 0, 1), sy)
    mid = (y > ym - 40) & (u >= 1)
    sy = np.where(mid, y - drop * fall * np.clip((y - (ym - 40)) / (drop + 160), 0, 1), sy)
    pinch = 1 + 0.16 * o * np.exp(-(((y - (ym + drop * 0.5)) / (drop * 0.6 + 60)) ** 2))
    sx = xm + (x - xm) * pinch
    out = cv2.remap(g, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if o > 0.01:
        inside = np.clip(np.minimum((y - top) / 10, (bot - y) / 14), 0, 1) * (u < 1)
        out = out * (1 - inside) + 0.004 * inside
        rim = np.exp(-((y - bot - 8) / 22) ** 2) * (u < 1)           # the lower lip, stretched thin, catches a little light
        out = np.clip(out * (1 - 0.25 * rim), 0, 1)
        out = np.where(np.abs(y - bot) < 26, cv2.GaussianBlur(out.astype(np.float32), (0, 0), 2.2), out)
    return out


if __name__ == '__main__':
    g = cv2.imread(os.path.join(D, 'faceshut_31.png'), 0).astype(np.float32) / 255
    s = skin_over(g)
    pre = []
    for j, o in enumerate((0, 0.1, 0.28, 0.5, 0.75, 1.0)):
        f = open_mouth(s, o)
        f = cv2.resize(f, (f.shape[1], int(f.shape[0] * 1.12)), interpolation=cv2.INTER_CUBIC)     # a long head
        cv2.imwrite(os.path.join(D, f'pre_{j}.png'), (np.clip(f, 0, 1) * 255).astype(np.uint8))
        pre.append(f)
    if '--pre' in sys.argv:
        sys.exit()
    import torch
    from PIL import Image
    from generate import load
    from diffusers import StableDiffusionXLImg2ImgPipeline
    pipe = StableDiffusionXLImg2ImgPipeline(**{k: v for k, v in load('realvis').components.items()})
    pipe.enable_model_cpu_offload()
    P = ('pale hairless human face with no eyes, smooth unbroken skin over the eye sockets, long head, huge open black mouth stretched down too far, '
         'thin stretched lips, half in shadow, pitch black background, black and white photograph, film grain, skin pores')
    N = 'eyes, eyeballs, eyelids, eyebrows, eyelashes, teeth, tongue, color, text, makeup, hair, cartoon, painting, cgi'
    for j, f in enumerate(pre):
        im = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8)).convert('RGB')
        W, H = 768, int(768 * im.height / im.width / 64) * 64
        p = P if j else P.replace('huge open black mouth stretched down too far, thin stretched lips', 'thin closed mouth')
        out = pipe(p, image=im.resize((W, H), Image.LANCZOS), strength=0.42, negative_prompt=N, num_inference_steps=36, guidance_scale=5.0,
                   generator=torch.Generator('cpu').manual_seed(7)).images[0]
        out.convert('L').save(os.path.join(D, f'call_{j}.png'))
        print('call', j, flush=True)
