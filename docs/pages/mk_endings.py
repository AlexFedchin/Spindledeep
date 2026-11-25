import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal

# gap between her skin and the doll (mm) over the last shot of the bitten ending, old film: frame, left hand, right hand (new: touch.py)
OLD = [(40, -13.6, -20.6), (48, -13.7, -20.7), (56, -13.8, -20.8), (64, -14.0, -20.5), (72, -14.2, -20.3), (80, -14.1, -20.1), (88, -13.7, -19.8), (96, -13.4, -18.8), (104, -12.9, -17.7), (112, -12.4, -16.5), (120, -11.1, -14.5), (128, -9.8, -12.5), (136, -8.2, -10.0), (144, -6.2, -7.2), (152, -4.2, -4.5), (160, -1.7, -1.2), (168, 0.8, 2.0), (176, 3.1, 5.0), (184, 5.5, 7.9), (192, 8.0, 10.8), (200, 10.0, 13.3), (208, 11.6, 15.2), (216, 12.7, 16.5), (224, 13.2, 17.2), (232, 13.3, 17.3), (240, 13.3, 17.3), (248, 13.3, 17.3)]


def gap_chart():
    W, H, l, r, t, b = 640, 250, 46, 12, 14, 30
    X = lambda f: l + (f - 40) / (248 - 40) * (W - l - r)
    Y = lambda mm: t + (26 - mm) / 52 * (H - t - b)
    g = ''
    for mm in (20, 10, 0, -10, -20):
        g += f'<line x1="{l}" x2="{W - r}" y1="{Y(mm):.1f}" y2="{Y(mm):.1f}" stroke="{"#a99f8c" if mm == 0 else "#2c2832"}" stroke-width="1"/><text x="{l - 8}" y="{Y(mm) + 4:.1f}" fill="#a99f8c" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">{mm:+d}</text>'
    for s in (0, 2, 4, 6, 8):
        g += f'<text x="{X(44 + s * 24):.1f}" y="{H - 8}" fill="#a99f8c" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">{s} s</text>'
    line = lambda i, d='': f'<polyline points="{" ".join(f"{X(q[0]):.1f},{Y(q[i]):.1f}" for q in OLD)}" fill="none" stroke="#a99f8c" stroke-width="2" {d}/>'
    g += line(1) + line(2, 'stroke-dasharray="5 4"') + f'<line x1="{X(40)}" x2="{X(248)}" y1="{Y(-0.8):.1f}" y2="{Y(-0.8):.1f}" stroke="#d8262c" stroke-width="3"/>'
    return f'''<div class="chart"><p class="legend"><span><i style="background:#a99f8c"></i>before, left hand</span><span><i style="background:repeating-linear-gradient(90deg,#a99f8c 0 5px,transparent 5px 9px)"></i>before, right hand</span><span><i style="background:#d8262c"></i>now, both hands</span></p>
<svg viewBox="0 0 {W} {H}" role="img" aria-label="Millimetres between the hands and the doll in the last shot">{g}</svg></div>'''


def clip(name, cap):
    return f'    <figure class="solo wide"><video muted loop playsinline controls preload="metadata" poster="img/{name}_after.jpg"><source src="vid/{name}.mp4" type="video/mp4"></video><figcaption>{cap}</figcaption></figure>\n'


def build(d):
    body = hero('the two ending films', 'Both Ends', 'the thaw, the chair', 'and the way down')
    body += f'''
  <div class="col summary">
    <p>Both ending films have been staged again by the rules of the new opening film. Hands rest on what they hold, feet stay where they are put, every camera runs straight at one speed, and each sound is placed by the movement that makes it. The bitten ending is {d['cut_len']} seconds long and the tied one {d['outro_len']}. The tied ending was made of drawn plates and is now animated throughout. It stays sealed near the bottom of this page.</p>
  </div>
  <div class="col"><p class="ask">do the samw thing with the ending cutscene: polish all the movements, the characters, the camera movement, act as a director and 3d supervisor. Rewatch the scene until it&rsquo;s perfect</p></div>

  <div class="screen"><video controls playsinline preload="metadata" poster="img/c5_after.jpg"><source src="vid/cut_720.mp4" type="video/mp4"></video>
    <p class="reveal-cap">The bitten ending, with sound</p></div>

  <h2>The thaw</h2>
  <div class="col">
''' + reveal('c1', 'c1_before.jpg', 'c1_after.jpg', 'Before: the cottage from far off, snow fading in patches', 'After: snow coming off the roof, ground showing through') + clip('c1', 'It runs on the very track the opening film starts with.') + '''    <ul class="what">
      <li><b>The snow lets go of the roof.</b> It cracks across, slides faster and faster, goes to pieces at the eave and bursts on the ground.</li>
      <li><b>The ground comes through from the house outward,</b> and grass grows where it has. One map drives both, so they cannot disagree.</li>
    </ul>
  </div>

  <h2>Her window</h2>
  <div class="col">
''' + reveal('c2', 'c2_before.jpg', 'c2_after.jpg', 'Before: round flowers on bare stems', 'After: sweet peas climbing the wool strung for them') + clip('c2', 'The stems climb, the leaves open, then the flowers. One lets a petal go.') + '''    <ul class="what">
      <li><b>The sweet peas climb.</b> Each stem winds up its own strand of wool, with leaves, tendrils and flowers that open in turn, and meltwater drips off the sill.</li>
      <li><b>The shutters are built of boards</b> with battens across. They were bare slabs.</li>
    </ul>
  </div>

  <h2>Her track</h2>
  <div class="col">
''' + reveal('c3', 'c3_before.jpg', 'c3_after.jpg', 'Before: flying over a thick grey band into the pit', 'After: the grey thread through the grass to the edge') + clip('c3', 'The same track as her walk in the opening film, with no one on it. A petal goes the way she went.') + '''  </div>

  <h2>Down the well</h2>
  <div class="col">
''' + reveal('c4', 'c4_before.jpg', 'c4_after.jpg', 'Before: the thread ended in mid-air', 'After: the thread comes over the lip') + '''    <p>The thread comes over the lip, lies down the rock and hangs free where the rock falls back. In the old film its top end hung in the open sky. Petals fall past, and the light on the walls goes as the mouth gets smaller.</p>
  </div>

  <h2>The chair</h2>
  <div class="col">
''' + reveal('c5', 'c5_before.jpg', 'c5_after.jpg', 'Before: a stool, a striped shawl, stiff arms', 'After: a rocking chair, a hand on the doll, the face looking up') + clip('c5', 'It rocks, strokes the doll, whispers, and looks up.') + f'''    <ul class="what">
      <li><b>The chair rolls on its runners</b> and everything in it goes with it: body, doll, hands. The empty chairs behind rock too, each in its own time.</li>
      <li><b>A hand strokes the doll&rsquo;s head</b> from brow to nape, again and again.</li>
      <li><b>The mouth moves with the whisper.</b> The jaw follows the recording itself, so it opens on the words.</li>
      <li><b>The petal lands on the hand.</b> Every chair stops in the same moment, the sounds stop with them, and only then does the face come up, straight at the camera.</li>
    </ul>
    {gap_chart()}
    <p class="reveal-cap">Millimetres between skin and doll in the last shot; below zero is inside</p>
    <p>In the old film both hands drifted from 2 cm inside the doll to 1.7 cm off it. Now they stay within 1.1 mm of its surface for all 336 frames, pressed in about as far as wool gives.</p>
    <div class="tablebox"><table class="windows"><tr><th>Shot</th><th>Flicker before</th><th>Now</th></tr>{d['flick']}</table></div>
    <p class="reveal-cap">Average back-and-forth change per pixel (0 to 255). In the track shot most of it is grass blades passing the camera.</p>
  </div>

  <h2>The camera</h2>
  <div class="col">
    <p>All twelve moves run in a straight line at one speed from the first frame to the last. Within any shot the fastest and slowest frames differ by at most 0.007 mm. Over snow and grass the cameras track sideways, so the engraved lines stand still on the ground.</p>
  </div>

  <h2>The dark</h2>
  <div class="col">
    <p>Where no light falls, no line is drawn any more. Before, figures standing in the dark were outlined and could be seen before they should be. This is in the grading step, so it applies to any film made from now on.</p>
  </div>

  <h2>The sound</h2>
  <div class="col">
    <ul class="what">
      <li><b>{d['nev']} sounds are written by the movement.</b> Each clod of snow, drop, runner, footfall and hand notes its own frame, and the moment of contact in the recording is laid on it.</li>
      <li><b>Checked in the finished files:</b> {d['sync']}</li>
      <li><b>No magic sounds</b> in either film. The tied ending has no music at all.</li>
    </ul>
  </div>

  <h2>The tied ending</h2>
  <div class="col">
    <p>Seven shots, all animated. Sealed, as you asked for this film.</p>
  </div>
  <details class="seal">
    <summary>Open the tied ending</summary>
    <div class="screen"><video controls playsinline preload="metadata" poster="img/o1_after.jpg"><source src="vid/outro_720.mp4" type="video/mp4"></video>
      <p class="reveal-cap">The tied ending, with sound</p></div>
    <div class="col">
''' + ''.join(reveal(f'o{k}', f'o{k}_before.jpg', f'o{k}_after.jpg', f'Shot {k} before', f'Shot {k} after') for k in range(1, 8)) + '''      <ul class="what">
        <li><b>The crowds walk.</b> Every foot is planted and stays until it lifts, and the nearest steps you hear are the ones you see.</li>
        <li><b>The hand on the doll&rsquo;s head</b> stays within 0.8 mm of it for 107 frames, the other within 0.8 mm for 89.</li>
        <li><b>The hands at the edge</b> close on the snow they rest on, finger by finger.</li>
      </ul>
    </div>
  </details>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The films</b><span><code>app/assets/cine/cut.mp4</code>, <code>outro.mp4</code></span></div>
    <div><b>The shots</b><span><code>scripts/cine/shots_end.py</code></span></div>
    <div><b>Lines in the dark</b><span><code>scripts/cine/post.py</code> (<code>BLACK</code>)</span></div>
    <div><b>Sounds and mix</b><span><code>scripts/cine/foley.py</code>, <code>edit.py</code></span></div>
    <div><b>Checks</b><span><code>scripts/cine/touch.py</code>, <code>synccheck.py</code></span></div>
  </div></div>
'''
    style = '''<style>
    .screen { max-width: 1040px; margin: 34px auto 18px; }
    .screen video, .solo video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    .solo.wide { max-width: 680px; }
    video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .reveal-cap { margin-top: 10px; }
    .col > .ask:only-child { margin-top: 26px; }
    details.seal { max-width: 900px; margin: 34px auto; border: 1px solid var(--rule); padding: 18px 22px; }
    details.seal summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
    details.seal summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    details.seal[open] summary { margin-bottom: 22px; }
  </style>
'''
    return page('endings', 'Both Ends: the ending films', style + body, ' &middot; <a href="https://claude.ai/artifact/U3awPggQ9kitFSbExvunak">by hand</a>')


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
