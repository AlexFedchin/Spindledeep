"""Spindledeep: record the knitter's lines in an old woman's voice (Qwen3-TTS, Apache-2.0).

Two kinds of take per line, both from the voice cast.py chose (.cache/cast/ref.wav):
  * design takes (`<id>_d<k>.wav`): VoiceDesign with the winning persona plus the line's delivery note (keeps the acting)
  * clone takes (`<id>_c<k>.wav`): the Base model cloning the reference voice (keeps her one consistent woman)
pick.py scores them all (words, likeness to the reference, how old it sounds, pace) and builds the shipped files.

    <qwen venv>/python scripts/voice/record.py [--design=6] [--clone=6] [ids...]
The first recording (younger-sounding) is kept in .cache/raw_young and app/assets/voice_young.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lines import LINES, PERSONAS  # noqa: E402

MODELS = os.environ.get('QWEN_MODELS', os.path.join(HERE, '.cache', 'models'))
RAW = os.path.join(HERE, '.cache', 'raw')
CAST = os.path.join(HERE, '.cache', 'cast')
SR = 24000


def trim(a, thr=0.006):
    idx = np.where(np.abs(a) > thr)[0]
    return a if not len(idx) else a[max(0, idx[0] - int(0.04 * SR)): idx[-1] + int(0.2 * SR)]


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    opt = lambda k, d: int(next((a.split('=')[1] for a in sys.argv if a.startswith(f'--{k}=')), d))
    nd, nc = opt('design', 6), opt('clone', 6)
    os.makedirs(RAW, exist_ok=True)
    cast = json.load(open(os.path.join(CAST, 'cast.json')))
    persona = PERSONAS[int(cast[0]['file'].split('_')[1])]
    from qwen_tts import Qwen3TTSModel
    todo = {lid: v for lid, v in LINES.items() if not ids or lid in ids}
    # design takes
    model = Qwen3TTSModel.from_pretrained(os.path.join(MODELS, 'Qwen3-TTS-12Hz-1.7B-VoiceDesign'), device_map='cuda:0',
                                          dtype=torch.bfloat16, attn_implementation='sdpa')
    for lid, (text, delivery) in todo.items():
        ks = [k for k in range(nd) if not os.path.exists(os.path.join(RAW, f'{lid}_d{k}.wav'))]
        if not ks:
            continue
        torch.manual_seed(2000 + sum(map(ord, lid)) + ks[0])
        w, sr = model.generate_voice_design(text=[text] * len(ks), language=['English'] * len(ks), instruct=[persona + ' Delivery: ' + delivery] * len(ks))
        for j, k in enumerate(ks):
            sf.write(os.path.join(RAW, f'{lid}_d{k}.wav'), trim(w[j].astype(np.float32)), sr)
        print('design', lid, flush=True)
    del model
    torch.cuda.empty_cache()
    # clone takes
    model = Qwen3TTSModel.from_pretrained(os.path.join(MODELS, 'Qwen3-TTS-12Hz-1.7B-Base'), device_map='cuda:0',
                                          dtype=torch.bfloat16, attn_implementation='sdpa')
    ref = os.path.join(CAST, 'ref.wav')
    ref_text = open(os.path.join(CAST, 'ref.txt'), encoding='utf-8').read().strip()
    prompt = model.create_voice_clone_prompt(ref_audio=ref, ref_text=ref_text)
    for lid, (text, delivery) in todo.items():
        ks = [k for k in range(nc) if not os.path.exists(os.path.join(RAW, f'{lid}_c{k}.wav'))]
        if not ks:
            continue
        torch.manual_seed(3000 + sum(map(ord, lid)) + ks[0])
        w, sr = model.generate_voice_clone(text=[text] * len(ks), language=['English'] * len(ks), voice_clone_prompt=prompt * len(ks))
        for j, k in enumerate(ks):
            sf.write(os.path.join(RAW, f'{lid}_c{k}.wav'), trim(w[j].astype(np.float32)), sr)
        print('clone', lid, flush=True)


if __name__ == '__main__':
    main()
