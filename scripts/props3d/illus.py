"""The picture printed on the seed packet: an old botanical plate of sweet peas (SDXL).  <art venv>/python scripts/props3d/illus.py
Candidates go to .cache/pea_<seed>.png; maps.py uses PEA."""
import os
import sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'art'))
import torch  # noqa: E402
from generate import load  # noqa: E402

pipe = load('sdxl')
r = pipe if not isinstance(pipe, tuple) else pipe[0]
for seed in (3, 11, 27, 41):
    im = r(prompt='antique botanical copperplate engraving of sweet pea flowers, Lathyrus odoratus, climbing stems with curling tendrils and several blossoms, '
                  'black ink on plain blank paper, 19th century seed catalogue illustration, fine crosshatching, centred, isolated',
           negative_prompt='color, text, letters, frame, border, photo, 3d, blurry, vase, hands, background scenery', width=832, height=1152,
           num_inference_steps=32, guidance_scale=6.5, generator=torch.Generator('cpu').manual_seed(seed)).images[0]
    im.save(os.path.join(HERE, '.cache', f'pea_{seed}.png'))
