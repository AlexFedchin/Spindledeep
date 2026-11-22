"""Changes page: the knitter's voice re-recorded to sound old (`oldvoice/`), with players for old and young sets.
Lines past the first are spoilers, so their players sit in a sealed <details>."""
import json, os, re, shutil, sys, subprocess
from mkpage import page, hero, HERE

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'voice'))
from lines import LINES  # noqa: E402

A = os.path.join(HERE, 'oldvoice', 'audio')
os.makedirs(A, exist_ok=True)
for d, tag in (('voice', 'old'), ('voice_young', 'young')):
    for lid in LINES:
        shutil.copy(os.path.join(ROOT, 'app', 'assets', d, lid + '.ogg'), os.path.join(A, f'{lid}_{tag}.ogg'))

# measures of the shipped files (both through the same cave chain), from age.py
Q = r'F:/LastBastion/last-bastion/scripts/audio/.cache/venv-qwen/Scripts/python.exe'
meas = {}
for d in ('voice_young', 'voice'):
    out = subprocess.run([Q, os.path.join(ROOT, 'scripts', 'voice', 'age.py')] + [os.path.join(ROOT, 'app', 'assets', d, l + '.ogg') for l in LINES],
                         capture_output=True, text=True, env={**os.environ, 'PYTHONUTF8': '1'}).stdout
    for ln in out.splitlines():
        m = re.match(r'(\S+)\.ogg (\{.*\}) age ([-0-9.]+)', ln)
        if m:
            meas[(d, m.group(1))] = (eval(m.group(2)), float(m.group(3)))

ORDER = list(LINES)
f0y = [meas[('voice_young', l)][0]['f0'] for l in ORDER]; f0o = [meas[('voice', l)][0]['f0'] for l in ORDER]
agy = [meas[('voice_young', l)][1] for l in ORDER]; ago = [meas[('voice', l)][1] for l in ORDER]
mean = lambda v: sum(v) / len(v)
rows = '\n'.join(f'          <tr><td>Line {i + 1}</td><td class="n">{y:.0f} Hz</td><td class="n">{o:.0f} Hz</td><td class="n">{ay:.1f}</td><td class="n">{ao:.1f}</td></tr>'
                 for i, (y, o, ay, ao) in enumerate(zip(f0y, f0o, agy, ago)))


def player(lid, label):
    return f'''      <div class="pair"><span class="who">{label}</span>
        <label>Old <audio controls preload="none" src="audio/{lid}_old.ogg"></audio></label>
        <label>Young <audio controls preload="none" src="audio/{lid}_young.ogg"></audio></label></div>
'''


STYLE = '''  <style>
    table.windows td, table.windows th { white-space: normal; vertical-align: top; }
    .pair { display: grid; grid-template-columns: 1fr; gap: 6px; margin: 14px 0 18px; padding: 12px 14px; border: 1px solid var(--rule); background: var(--ink-2); }
    .pair .who { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--paper-dim); }
    .pair label { display: flex; align-items: center; gap: 12px; font-family: var(--mono); font-size: 12px; color: var(--paper); }
    .pair audio { flex: 1; height: 32px; min-width: 0; }
    details.seal { margin: 26px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 20px 24px; text-align: center; font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: 'IM Fell English', serif; font-style: italic; text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal .inner { padding: 0 20px 18px; }
  </style>
'''
sealed = ''.join(player(l, f'Line {i + 1}') for i, l in enumerate(ORDER) if i > 0)

body = STYLE + hero('voice', 'Seventy Winters in Her Voice', 'Her lines re-recorded to sound old', 'and the first recording kept, one word away') + f'''
  <div class="col summary">
    <p>Her lines now sound like an old woman's: lower, with an unsteady, breathy quality and a slow tremor. They're also one consistent woman from the first line to the last. The first recording isn't gone: it's kept beside the new one, and the game switches between them with one word.</p>
  </div>

  <h2>Listen</h2>
  <p class="ask">Try re-recording first, but do not completely remove the old variant. Leave it there in case I wanna switch it back. Do your best in making the voice sound old.</p>
  <div class="col">
    <p>The first line, the note she leaves at the lip of the pit, new and old side by side:</p>
{player(ORDER[0], 'Line 1 · the note')}
    <details class="seal">
      <summary>The other eight lines &middot; spoilers<span>Their words give the story away. Open after you've played.</span></summary>
      <div class="inner">
{sealed}      </div>
    </details>
  </div>

  <h2>How it was done</h2>
  <div class="col">
    <p>I can't listen, so I built an ear out of measurements. An old woman's voice differs from a young one's in ways you can measure: it sits lower (women in their eighties are typically around 150–175 Hz, young women around 200–230 Hz), the pitch wobbles from cycle to cycle, there's more breath and roughness, and a slow tremor rides on held vowels.</p>
    <ul class="what">
      <li><b>Casting one voice.</b> The voice model designed 24 candidate voices from three descriptions of a very old woman, all reading the same sentence. The winner, from “a very old lady, about ninety: a dry, crackly, wavering voice with a strong tremolo”, had the lowest steady pitch, the most wobble and breath, and every word right.</li>
      <li><b>Two kinds of take per line,</b> 12 in all. Six were designed fresh from that description plus the line's delivery note, which keeps the acting. Six cloned the cast voice exactly, which keeps her one woman. That's 108 takes.</li>
      <li><b>Choosing.</b> Each take was scored on four things: the words are right (a single wrong word rules it out), how like the cast voice it is, how old it measures, and how unhurried it is. Five lines kept their acted takes, and four went to clones, slowed by up to 15% where they hurried.</li>
      <li><b>A light ageing touch</b> on top: a hair lower (half a semitone), a slow 5 Hz tremor of about ±¼ semitone, and a matching small swell in level.</li>
      <li><b>Every finished file was transcribed again.</b> On one take the ageing blurred “Pluck your thread”, which is the line that teaches you to pluck, so the next-best take was used instead.</li>
    </ul>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Shipped files</th><th class="n">Pitch, young</th><th class="n">Pitch, old</th><th class="n">Age score, young</th><th class="n">old</th></tr></thead>
        <tbody>
{rows}
          <tr><td><b>Average</b></td><td class="n">{mean(f0y):.0f} Hz</td><td class="n">{mean(f0o):.0f} Hz</td><td class="n">{mean(agy):.1f}</td><td class="n">{mean(ago):.1f}</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px">The age score runs from about 0 (a young woman) to 3 (a very old one). The young set ranged from 0.4 to 2.7 and from 119 to 218 Hz: effectively a different woman on every line. The new set sits at 2.4–2.9 and 136–166 Hz.</p>
    <p style="margin-top:16px">Not checked:</p>
    <ul class="what open">
      <li>Whether she sounds old to you. The numbers above are the best stand-in for an ear I have, but they're not one. If any line still sounds wrong, tell me which and I'll redo just that line.</li>
      <li>One of the two lines with a second, lower voice mixed under hers can blur one word a little. That's the effect doing its job, but it's worth a listen.</li>
    </ul>
  </div>

  <h2>Switching back</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/audio.js</code></b><span>Near the top of the file: <code>VOICE_SET = 'voice'</code> plays the old woman; change it to <code>'voice_young'</code> for the first recording.</span></div>
      <div><b><code>app/assets/voice_young/</code></b><span>The first recording, untouched. Its raw takes are kept too, in <code>scripts/voice/.cache/raw_young</code>.</span></div>
      <div><b><code>scripts/voice/</code></b><span><code>age.py</code> (the measurements), <code>cast.py</code> (choosing the voice), <code>record.py</code> and <code>pick.py</code> (recording, choosing, ageing, checking).</span></div>
    </div>
  </div>
'''
PREV = (' &middot; <a href="https://claude.ai/artifact/WGTgv9q1fD1XJBdv9Kqnc8">a darker thread</a>'
        ' &middot; <a href="https://claude.ai/artifact/MswAJ32Cd7SY1zfuP2jvV1">her own two hands</a>')
print(page('oldvoice', 'Spindledeep · Seventy Winters in Her Voice', body, PREV))
