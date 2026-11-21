"""Spindledeep: record the knitter's memories with Qwen3-TTS 1.7B VoiceDesign (Apache-2.0).

Each line is performed from the persona plus a per-line delivery note; several takes are kept,
pick.py scores them with Whisper and builds the shipped .ogg files.

    <qwen venv>/python scripts/voice/record.py [--takes=4] [ids...]
The venv/models are the ones described in docs/AUDIO.md (env QWEN_MODELS overrides the model dir).
"""
import os
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lines import LINES, PERSONA  # noqa: E402

MODELS = os.environ.get('QWEN_MODELS', os.path.join(HERE, '.cache', 'models'))
RAW = os.path.join(HERE, '.cache', 'raw')
SR = 24000


def trim(a, thr=0.006):
    idx = np.where(np.abs(a) > thr)[0]
    return a if not len(idx) else a[max(0, idx[0] - int(0.04 * SR)): idx[-1] + int(0.2 * SR)]


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    n = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--takes=')), 4))
    os.makedirs(RAW, exist_ok=True)
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(os.path.join(MODELS, 'Qwen3-TTS-12Hz-1.7B-VoiceDesign'), device_map='cuda:0',
                                          dtype=torch.bfloat16, attn_implementation='sdpa')
    for lid, (text, delivery) in LINES.items():
        if ids and lid not in ids:
            continue
        todo = [k for k in range(n) if not os.path.exists(os.path.join(RAW, f'{lid}_{k}.wav'))]
        if not todo:
            continue
        torch.manual_seed(1000 + sum(map(ord, lid)) + todo[0])
        ins = PERSONA + ' Delivery: ' + delivery
        w, sr = model.generate_voice_design(text=[text] * len(todo), language=['English'] * len(todo), instruct=[ins] * len(todo))
        for j, k in enumerate(todo):
            sf.write(os.path.join(RAW, f'{lid}_{k}.wav'), trim(w[j].astype(np.float32)), sr)
        print('recorded', lid, flush=True)


if __name__ == '__main__':
    main()
