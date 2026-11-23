"""Spindledeep: zone backdrops and title art, generated locally with SDXL.

The game never shows these pictures as they come out. The renderer treats them as
tone maps (light and shadow only) and engraves them with its own line work, so
the prompts ask for monochrome matte paintings with strong form and depth.

    python scripts/art/download.py                       # fetch the models once (~13 GB)
    python scripts/art/generate.py realvis brink bells --seeds 3
    python scripts/art/generate.py sdxl                  # every shot, base SDXL
Candidates go to scripts/art/.cache/out/<engine>/<shot>_<seed>.png; pick one and run
layers.py on it. Run with scripts/art/.cache/venv/Scripts/python.exe (torch + diffusers).
Models: Stable Diffusion XL 1.0 / RealVisXL V5.0, both CreativeML Open RAIL++-M.
"""
import argparse
import os
import time

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
M = os.path.join(HERE, '.cache', 'models')
OUT = os.path.join(HERE, '.cache', 'out')

STYLE = ('monochrome charcoal matte painting, black and white, dark fantasy concept art, vast scale, '
         'atmospheric perspective, layered depth, mist, chiaroscuro, lonely, melancholic, highly detailed')
NEG = ('color, colorful, saturated, text, watermark, logo, signature, frame, border, people, crowd, '
       'cartoon, anime, bright daylight, blurry, lowres, deformed, jpeg artifacts')

# (prompt, width, height). Subject first: SDXL's two encoders each read only 77 tokens.
SHOTS = {
    'brink': ('a lone small wooden cottage with one candle-lit window standing at the very edge of an enormous round black pit '
              'in the ground, snowy cliffs, bare dead trees, huge pale full moon low in the night sky, falling snow', 1344, 768),
    'sky': ('a huge pale full moon low over distant jagged snowy mountains and a frozen misty valley at night, a ridge of bare '
            'dead trees silhouetted against the clouds, falling snow, empty wilderness', 1344, 768),
    'throat': ('looking across an immense vertical cave shaft descending into darkness, ancient twisted roots and old wooden '
               'scaffolding clinging to the rock walls, hanging rusted chains, a pale beam of moonlight falling from far above', 768, 1344),
    'gardens': ('an immense underground cavern overgrown with hanging pale roots like curtains, ruined stone arches and '
                'crumbling stairs, giant pale mushrooms, drifting spores, mist between the pillars', 1344, 768),
    'bells': ('a vast underground cathedral cavern with hundreds of old bronze bells hanging on long chains at different heights '
              'over a bottomless chasm, gothic stone arches carved into the cave walls, mist', 1344, 768),
    'mere': ('a still black underground lake in an enormous cave, huge stalactites hanging from the ceiling reflected in the '
             'water, a broken stone bridge, low fog over the water, faint light far away', 1344, 768),
    'loom': ('an enormous ancient wooden loom and a giant spinning wheel deep in a cave, thousands of threads strung across the '
             'cavern like a web, an empty rocking chair beneath it, dust in the air', 1344, 768),
    # the deep (2026-11-23)
    'hush': ('a long low cavern whose walls are made of packed grey woollen cloth and old blankets pressed into the rock, '
             'countless limp knitted sleeves hanging from the ceiling like roots, total darkness fading into fog', 1344, 768),
    'treadles': ('the underside of a colossal ancient wooden weaving loom in a cave, giant treadles, beams, ropes and pulleys, '
                 'heavy heddle frames hanging on chains, dust, machinery of a forgotten mill', 1344, 768),
    'loomdeep': ('a colossal cavern filled with thousands of vertical threads strung from a dark ceiling like a harp, a vast '
                 'woven cloth floor rising in folds like a sea, a wooden beam high above, enormous scale, dread', 1024, 1152),
    'title': ('a tiny knitted yarn doll seen from behind standing on a rock ledge at the edge of an enormous dark abyss, '
              'a single thread trailing behind it up the cliff to a distant lone cottage with a lit window, huge pale moon', 1344, 768),
}


def load(engine):
    from diffusers import StableDiffusionXLPipeline, AutoencoderKL, DPMSolverMultistepScheduler
    vae = AutoencoderKL.from_pretrained(os.path.join(M, 'sdxl-vae-fix'), torch_dtype=torch.float16)
    pipe = StableDiffusionXLPipeline.from_pretrained(os.path.join(M, engine), vae=vae, torch_dtype=torch.float16, variant='fp16')
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
    pipe.enable_model_cpu_offload()
    pipe.vae.enable_tiling()
    return pipe


def run(engine, shots, seeds, seed0):
    pipe = load(engine)
    os.makedirs(os.path.join(OUT, engine), exist_ok=True)
    for shot in shots:
        prompt, w, h = SHOTS[shot]
        for k in range(seeds):
            seed = seed0 + k
            path = os.path.join(OUT, engine, f'{shot}_{seed}.png')
            if os.path.exists(path):
                continue
            t0 = time.time()
            g = torch.Generator('cpu').manual_seed(seed)
            img = pipe(prompt, prompt_2=prompt + ', ' + STYLE, negative_prompt=NEG, width=w, height=h, num_inference_steps=30,
                       guidance_scale=6.5 if engine == 'sdxl' else 5.0, generator=g).images[0]
            img.save(path)
            print(f'{engine} {shot} seed {seed}: {time.time() - t0:.1f} s', flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('engine', choices=['sdxl', 'realvis'])
    ap.add_argument('shots', nargs='*')
    ap.add_argument('--seeds', type=int, default=3)
    ap.add_argument('--seed', type=int, default=11)
    a = ap.parse_args()
    run(a.engine, a.shots or list(SHOTS), a.seeds, a.seed)
