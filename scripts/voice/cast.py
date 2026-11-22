"""Spindledeep: cast the knitter's voice. Qwen3-TTS VoiceDesign reads REF_TEXT in every PERSONAS description with
several seeds; each candidate is scored for sounding old (age.py) and for saying the words (Whisper). The winner is
saved as the reference voice that record.py clones for every line, so all her lines are one woman.

    <qwen venv>/python scripts/voice/cast.py [--seeds=8]
Writes .cache/cast/cand_<p>_<s>.wav, cast.json (all scores) and ref.wav (+ ref.txt).
"""
import difflib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lines import PERSONAS, REF_TEXT  # noqa: E402
from age import measures, age_score  # noqa: E402

MODELS = os.environ.get('QWEN_MODELS', os.path.join(HERE, '.cache', 'models'))
OUT = os.path.join(HERE, '.cache', 'cast')


def words(t):
    return re.sub(r"[^a-z' ]", ' ', t.lower()).split()


def main():
    seeds = int(next((a.split('=')[1] for a in sys.argv if a.startswith('--seeds=')), 8))
    os.makedirs(OUT, exist_ok=True)
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(os.path.join(MODELS, 'Qwen3-TTS-12Hz-1.7B-VoiceDesign'), device_map='cuda:0',
                                          dtype=torch.bfloat16, attn_implementation='sdpa')
    for pi, persona in enumerate(PERSONAS):
        todo = [k for k in range(seeds) if not os.path.exists(os.path.join(OUT, f'cand_{pi}_{k}.wav'))]
        if not todo:
            continue
        torch.manual_seed(500 + pi * 37 + todo[0])
        ins = persona + ' Delivery: warm but tired, unhurried, as if talking to someone she loves by the fire.'
        w, sr = model.generate_voice_design(text=[REF_TEXT] * len(todo), language=['English'] * len(todo), instruct=[ins] * len(todo))
        for j, k in enumerate(todo):
            sf.write(os.path.join(OUT, f'cand_{pi}_{k}.wav'), w[j].astype(np.float32), sr)
        print('cast persona', pi, flush=True)
    del model
    torch.cuda.empty_cache()
    import whisper
    asr = whisper.load_model(os.path.join(MODELS, 'whisper', 'large-v3-turbo.pt'), device='cuda')
    ref = words(REF_TEXT)
    res = []
    for f in sorted(os.listdir(OUT)):
        if not f.startswith('cand_'):
            continue
        p = os.path.join(OUT, f)
        a, sr = sf.read(p)
        m = measures(a, sr)
        acc = difflib.SequenceMatcher(None, ref, words(asr.transcribe(p, language='en')['text'])).ratio()
        ag = age_score(m)
        res.append({'file': f, 'acc': round(acc, 3), 'age': round(ag, 3), **m, 'score': round(ag + (3.0 if acc > 0.9 else 3.0 * acc - 1.0), 3)})
    res.sort(key=lambda r: -r['score'])
    json.dump(res, open(os.path.join(OUT, 'cast.json'), 'w'), indent=1)
    for r in res[:8]:
        print(r, flush=True)
    best = res[0]
    a, sr = sf.read(os.path.join(OUT, best['file']))
    sf.write(os.path.join(OUT, 'ref.wav'), a, sr)
    open(os.path.join(OUT, 'ref.txt'), 'w', encoding='utf-8').write(REF_TEXT)
    print('REFERENCE', best['file'], flush=True)


if __name__ == '__main__':
    main()
