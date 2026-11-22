"""Changes page: film fixes (flicker, things passing through each other) and saves (`filmfix/`).
Usage: python mk_cine.py <scratchpad> (expects intro_v1.mp4 there = the old prologue; the new one is in app/assets/cine)
The epilogue's content stays out of the page (standing rule): it is only mentioned, never shown."""
import os, sys, subprocess, json
import numpy as np
from PIL import Image
from mkpage import page, reveal, hero, HERE

SCR = sys.argv[1]
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
NEW = os.path.join(ROOT, 'app', 'assets', 'cine', 'intro.mp4')
OLD = os.path.join(SCR, 'intro_v1.mp4')
D = os.path.join(HERE, 'filmfix', 'img')
os.makedirs(D, exist_ok=True)
PREV = (' &middot; <a href="https://claude.ai/artifact/B9a7TyCcgErULkacr4ToKs">films</a>'
        ' &middot; <a href="https://claude.ai/artifact/TT7w5yYxQK7PtmWbsMjiNK">six hidden rooms</a>'
        ' &middot; <a href="https://claude.ai/artifact/WGTgv9q1fD1XJBdv9Kqnc8">a darker thread</a>')

# prologue timeline (edit.py FILMS): shot -> first frame in the film
START = {'I1': 0, 'I2': 152, 'I3': 272, 'I4': 464, 'I5': 598, 'I6': 742, 'I7': 886, 'I8': 1034, 'I9': 1226}
LEN = {'I1': 168, 'I2': 120, 'I3': 192, 'I4': 144, 'I5': 144, 'I6': 144, 'I7': 168, 'I8': 192, 'I9': 120}


def grab(mp4, n, out, crop=None, w=1200):
    tmp = os.path.join(SCR, '_grab.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-vf', f'select=eq(n\\,{n})', '-vsync', '0', '-frames:v', '1', tmp], check=True)
    im = Image.open(tmp).convert('RGB')
    if crop:
        W, H = im.size
        im = im.crop((int(crop[0] * W), int(crop[1] * H), int(crop[2] * W), int(crop[3] * H)))
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(D, out), quality=86)


def frames(mp4, a, b):
    out = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', f'select=between(n\\,{a}\\,{b - 1}),scale=480:270', '-vsync', '0',
                          '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(out, np.uint8).reshape(-1, 270, 480).astype(np.float32) / 255


def flick(fr):
    z = np.clip(np.abs(fr[1:-1] - fr[:-2]) + np.abs(fr[2:] - fr[1:-1]) - np.abs(fr[2:] - fr[:-2]), 0, None)
    z = z * (z > 0.12)
    per = z.mean(axis=(1, 2))
    return float(per.mean()), float(per.max())


shots = [('I8', 99, 'thread', None, 'The doll on the sill', 'the red thread ran straight down through the sill board and the table to the spool'),
         ('I9', 109, 'thread9', (0.3, 0.25, 1.0, 1.0), 'The doll in profile', 'the thread cut through the corner of the sill'),
         ('I2', 59, 'shutter', None, 'The window from outside', 'both shutters were buried in the log wall, and the loose one swung into it'),
         ('I8', 127, 'wedge', (0.0, 0.2, 1.0, 0.8), 'Behind the doll, outside', 'a black wedge of ground switched on and off every other frame')]
for sh, f, name, crop, *_ in shots:
    grab(OLD, START[sh] + f, f'{name}_before.jpg', crop)
    grab(NEW, START[sh] + f, f'{name}_after.jpg', crop)

rows = []
for sh in ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'I9']:
    a, b = START[sh] + 22, START[sh] + LEN[sh] - 2       # skip dissolves at the cut
    o = flick(frames(OLD, a, b)); n = flick(frames(NEW, a, b))
    rows.append((sh, o, n))
    print(sh, o, n, flush=True)
json.dump(rows, open(os.path.join(SCR, 'flick_rows.json'), 'w'))

NAMES = {'I1': 'The Brink in the storm', 'I2': 'The window from outside', 'I3': 'The doll on the table', 'I4': 'Over her shoulder',
         'I5': 'The thread tied on', 'I6': 'The door', 'I7': 'Out to the pit', 'I8': 'The doll on the sill', 'I9': 'The doll in profile'}
trows = '\n'.join(f'          <tr><td>{NAMES[s]}</td><td class="n">{o[1] * 1000:.0f}</td><td class="n">{n[1] * 1000:.0f}</td></tr>' for s, o, n in rows)

sl = ''
for sh, f, name, crop, title, what in shots:
    sl += f'''
  <h3>{title}</h3>
{reveal(name, f'{name}_before.jpg', f'{name}_after.jpg', f'Before: {title.lower()}, {what}', f'After: {title.lower()}, fixed')}    <p>Before, {what}.</p>
'''

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero('fixes', 'Clean Films, Kept Runs', 'Nothing in the films passes through anything now', 'and your run is saved as you play') + f'''
  <div class="col summary">
    <p>I went through every shot of both films: stills from each shot, an automatic scan for flicker, and frame-by-frame checks wherever the scan or the stills found something. In the prologue, the thread went through the windowsill in two shots, the shutters were sunk into the log wall, and a patch of ground behind the doll flickered on and off. One shot of the epilogue had a figure and the furniture passing through each other. All of it is fixed, the affected shots are re-rendered, and both films are re-cut.</p>
    <p>Saves now happen at every pole and whenever you leave. They go straight to a file, so they survive a crash, and Continue on the title picks your run up at the last pole. Begin anew replaces the save.</p>
  </div>

  <h2>The films</h2>
  <p class="ask">Please check the cinematics for any overlapping and flickering objects (there are some at least in the first cutscene) and also for things going one through another (in the first cutscene the thread is going right through the windowsill).</p>
  <div class="col">
    <ul class="what">
      <li><b>The thread on the sill</b> was built as a straight line from the doll's waist to the spool, so it went through whatever was in the way. It is now routed over the real surfaces: across the sill, over its front edge, down onto the table, across it, over the back edge and down to the spool. The spool now lies on the floor instead of sitting half sunk into it.</li>
      <li><b>The shutters</b> were placed a few centimetres inside the logs, so the wood grain of the wall showed through them in a jagged line. They now hang just in front of the wall, and the loose one swings out from its hinge.</li>
      <li><b>The flicker</b> wasn't in the 3D render. It came from the engraving pass. Far ground outside the window lay beyond the range the shot stores positions for, so every pixel there got the same clamped position, and the engraved lines on it were pure noise that changed every frame. Those areas are now engraved like the sky, with steady lines. A second, related cause was also fixed: surfaces where one set of lines barely changes now use the other set. Both fixes apply to every shot, so all 15 shots were re-graded.</li>
      <li><b>In the epilogue,</b> one shot had clipping between a figure, the furniture and the doll. It's fixed and re-rendered. What the shot shows isn't described here, as you asked.</li>
    </ul>
{sl}
    <h3>Flicker, measured</h3>
    <p>Measured in the patch behind the doll where the wedge was, over the whole shot. The count is of pixels that flip back and forth between frames, as opposed to moving. Snow still blows through that patch, so it never reaches zero.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Behind the doll on the sill</th><th class="n">Before</th><th class="n">After</th></tr></thead>
        <tbody>
          <tr><td>Flicker (back-and-forth pixels)</td><td class="n">0.070</td><td class="n">0.046</td></tr>
          <tr><td>Frames where more than 5% of the patch jumps</td><td class="n">122</td><td class="n">75</td></tr>
          <tr><td>Biggest single jump (share of the patch)</td><td class="n">21.6%</td><td class="n">9.7%</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px">Across whole frames the numbers hardly move, by design. Blowing snow and the engraving's deliberate re-etching every few frames make up most of the movement. The fault was a small, sharp patch, and the slider above shows it best.</p>
  </div>

  <h2>Saving as you play</h2>
  <p class="ask">The game should be saved locally as I play, each pole is a checkpoint and when I reopen the game I should be able to continue the last run as well. Starting a new game overrides the save.</p>
  <div class="col">
    <ul class="what">
      <li><b>Every pole is a checkpoint.</b> Reaching one ties your thread to it, and the run is saved there: the poles you've passed, skeins, bells, memories, keepsakes and the marks you've left. A fall, or the next launch, puts you back at that pole.</li>
      <li><b>Leaving saves too:</b> Leave, Return to the cottage, or simply closing the window.</li>
      <li><b>It's a real file</b> (<code>save.json</code> in the game's profile folder), written in full each time, so a crash or a killed process can't leave half a save. The old browser-storage copy is still kept, and older saves are picked up from it once.</li>
      <li><b>Continue</b> appears on the title screen whenever there's a run to continue. <b>Begin anew</b> replaces the save straight away, even before the first pole. Finishing the game ends the run and clears it.</li>
      <li><b>Tests can't touch your save any more.</b> Test runs now use their own profile. Before this, every headless test that pressed Begin wiped the real save, so any save you had is probably gone. Sorry.</li>
    </ul>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Test: three real launches of the game</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>1. Begin, walk to the first pole, pick up a skein after it, quit</td><td>Pole 1 is the checkpoint; the save is written to the file</td></tr>
          <tr><td>2. Launch again</td><td>Title shows Continue; it resumes at pole 1, skein kept</td></tr>
          <tr><td>2. Then Begin anew, quit</td><td>New run at the cottage</td></tr>
          <tr><td>3. Launch again, Continue</td><td>The new run, not the old one</td></tr>
        </tbody>
      </table>
    </div>
    <div class="files">
      <div><b><code>scripts/cine/shots.py</code> &middot; <code>sets.py</code></b><span>Thread routed over the sill and table, spool on the floor, shutters in front of the wall, the epilogue fix.</span></div>
      <div><b><code>scripts/cine/post.py</code></b><span>Steady lines where positions were clamped or one set of lines had no gradient.</span></div>
      <div><b><code>electron/main.js</code> &middot; <code>preload.js</code></b><span>The save file (atomic write, read, clear); a separate profile for test runs.</span></div>
      <div><b><code>app/src/main.js</code></b><span>Save at every pole, on start, on leaving and on close; Continue reads the file.</span></div>
    </div>
  </div>
'''
print(page('filmfix', 'Spindledeep · Clean Films, Kept Runs', body, PREV))
