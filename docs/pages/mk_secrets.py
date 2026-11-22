"""Changes pages: honest swing from a dead hang (`swinghang/`) and the hidden rooms (`secrets/`).
Usage: python mk_secrets.py <scratchpad with PNG shots> [swing page link]"""
import os, sys
from PIL import Image
from mkpage import page, reveal, hero, HERE

SCR = sys.argv[1]
LINK_SWING = sys.argv[2] if len(sys.argv) > 2 else ''
PREV = (' &middot; <a href="https://claude.ai/artifact/JzmLpGyUBh3znCBjUsrkhB">swing</a> &middot; <a href="https://claude.ai/artifact/NWsF2b8neqxPDeXkb87drj">woodpile</a>'
        ' &middot; <a href="https://claude.ai/artifact/2SAfoyAEphasPyCVz1D1Ac">relics</a> &middot; <a href="https://claude.ai/artifact/Nh1VeLbx1fMGjRYnnwYxuB">storm</a>'
        ' &middot; <a href="https://claude.ai/artifact/B9a7TyCcgErULkacr4ToKs">films</a> &middot; <a href="https://claude.ai/artifact/G8XsmEWzRJh2bCP3XYXowF">dead ends</a>')


def jpg(src, dst_dir, name):
    os.makedirs(dst_dir, exist_ok=True)
    im = Image.open(os.path.join(SCR, src)).convert('RGB')
    im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    im.save(os.path.join(dst_dir, name), quality=86)


M = 'fill:var(--paper-dim);font-family:var(--mono);font-size:11px'


def chart(series, ymax, yt, label, aria):
    x0, x1, y0, y1 = 52, 604, 170, 20
    X = lambda i: x0 + (x1 - x0) * i / 5
    Y = lambda v: y0 - (y0 - y1) * min(v, ymax) / ymax
    s = [f'<svg viewBox="0 0 640 200" role="img" aria-label="{aria}">']
    for v, t in yt:
        s.append(f'<line x1="{x0}" x2="{x1}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" style="stroke:var(--rule);stroke-width:1;fill:none"/>')
        s.append(f'<text x="{x0 - 8}" y="{Y(v) + 4:.1f}" text-anchor="end" style="{M}">{t}</text>')
    for i in range(6):
        s.append(f'<text x="{X(i):.1f}" y="192" text-anchor="middle" style="{M}">{label(i)}</text>')
    for vals, st, col in series:
        d = ' '.join(f'{"M" if i == 0 else "L"}{X(i):.1f},{Y(v):.1f}' for i, v in enumerate(vals))
        s.append(f'<path d="{d}" style="fill:none;{st}"/>')
        for i, v in enumerate(vals):
            s.append(f'<circle cx="{X(i):.1f}" cy="{Y(v):.1f}" r="3" style="fill:{col}"/>')
    s.append('</svg>')
    return '\n'.join(s)


OLD = 'stroke:var(--paper-dim);stroke-width:1.6;stroke-dasharray:5 4'
NEW = 'stroke:var(--red);stroke-width:2.2'
LEG = '<div class="legend"><span><i style="background:var(--paper-dim)"></i>Before</span><span><i style="background:var(--red)"></i>After</span></div>'

# ── page 1: the swing ─────────────────────────────────────────────────────
gaps = [('Gallery: west ledge → pillar 1', 0.7, 0.9, 31, 30), ('Gallery: pillar 1 → 2', 0.9, 1.0, 25, 18), ('Gallery: pillar 2 → 3', 0.9, 1.1, 25, 23),
        ('Gallery: pillar 3 → 4', 1.1, 1.2, 50, 6), ('Gallery: pillar 4 → 5', 1.0, 1.1, 23, 21), ('Gallery: pillar 5 → east ledge', 0.7, 0.9, 31, 25),
        ('Mere: east shore → isle 1', 0.8, 0.9, 53, 52), ('Mere: isle 1 → 2', 1.0, 1.1, 30, 21), ('Mere: isle 2 → 3', 1.1, 1.2, 50, 49),
        ('Mere: isle 3 → 4', 0.8, 1.0, 27, 25), ('Mere: isle 4 → 5', 0.8, 1.0, 28, 25), ('Mere: isle 5 → 6', 0.9, 0.9, 27, 25)]
rows = '\n'.join(f'          <tr><td>{n}</td><td class="n">{a} s</td><td class="n">{b} s</td><td class="n">{c / 10:.1f} s</td><td class="n">{d / 10:.1f} s</td></tr>'
                 for n, a, b, c, d in gaps)
swing_chart = chart([([45.9, 101, 163.7, 171.8, 177.1, 168.7], OLD, 'var(--paper-dim)'), ([5.6, 15.9, 30.7, 51.9, 53.8, 81.1], NEW, 'var(--red)')],
                    180, [(0, '0°'), (45, '45°'), (90, '90°'), (180, 'over')], lambda i: f'swing {i + 1}',
                    'Highest angle of each half-swing when leaning in time from a dead hang under a ring. Before: 46 degrees on the first swing, then over the top. '
                    'After: 6, 16, 31, 52, 54, 81 degrees.')

body = hero('physics fix', 'A Swing Has to Be Earned', 'From a dead hang she only rocks', 'every pass through the bottom builds on the last') + f'''
  <div class="col summary">
    <p>Hanging still against a wall, holding a direction carried the doll most of the way to horizontal in one go. Leaning pushed her sideways with a fixed force, as if someone was shoving her, so it didn't matter that she had no room or speed to build a swing.</p>
    <p>Now a lean behaves like a child pumping a swing. It pushes along the arc, its strength grows with how fast she is already swinging, and it fades out near horizontal. From a dead hang the first swing is tiny, and the swing grows only by leaning in time, pass after pass.</p>
  </div>

  <h2>Hanging off a cliff</h2>
  <p class="ask">When I hang off the edge of a cliff with a wall on one side and nothing on the other I can “swing” to almost like 90 degrees even though I have no space to start the swing. It should be impossible, the first swing should be only super short and only when I come to the other side it gets larger, like the real swing.</p>
  <div class="col">
    <p>This is a physics change, so the page uses numbers instead of screenshots. Everything below comes from the game's own physics. In the test, the doll walks off the east edge of the first Bell Gallery pillar, grips while falling, waits until she hangs still against the pillar's face, then leans away from the wall.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Hanging still against the pillar</th><th>Before</th><th>After</th></tr></thead>
        <tbody>
          <tr><td>Hold away from the wall</td><td class="n">61.6°</td><td class="n">4.5°</td></tr>
          <tr><td>Lean in time with the swing</td><td class="n">62.9°</td><td class="n">8.5°</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px">With the wall beside her, every swing back runs into the rock and loses its speed, so she can't build up. That's what a real wall does to a real swing.</p>

    <h3>In open air, from a dead hang</h3>
    <div class="chart">
      {LEG}
      {swing_chart}
    </div>
    <p>Hanging still under a ring with clear air on both sides and leaning in time with the swing: before, the first swing went to 46° and the second went over the top of the ring. Now the swings grow 6°, 16°, 31°, 52°, 54°, then 81°. Holding one direction the whole time, without timing it, now does almost nothing, where before it reached 47°.</p>
    <ul class="what">
      <li><b>How the lean works now.</b> The push points along the arc instead of straight sideways, so a lean can never pull her against the thread. Its strength rises with her swing speed and reaches full power at 8 m/s; from a standstill she gets 6% of it. It also fades with the angle, so near horizontal leaning can't add height. Leaning against the swing still brakes it.</li>
      <li><b>Walking off a ledge with grip held</b> used to leave her balanced on the rounded corner with the thread pulled flat. Now the thread keeps paying out while she rolls over the lip, so she drops into a hang under the edge. That's the situation you described, and it works from either a walk-off or a grip in mid-fall.</li>
    </ul>
  </div>

  <h2>Every ring gap still works</h2>
  <div class="col">
    <p>All 12 gaps were simulated again: run-up, jump, catch, let-go at every time from 0.1 to 6 s, with grip pressed early or at the ring, and with holding forward or leaning in time. Every gap still has let-go windows in all four styles. A catch keeps a quarter of her jump speed, which is enough for the new lean to work with, so crossing a gap feels much as before. The let-go window is a little later, because the first swing builds more slowly.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Gap</th><th>First let-go</th><th>now</th><th>Lands for</th><th>now</th></tr></thead>
        <tbody>
{rows}
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px">“First let-go” is the earliest let-go after the catch that lands on the next platform. “Lands for” adds up every let-go moment, in 0.1 s steps, that lands on the next platform when holding forward with an early grip. Pillar 3 → 4 is now the tightest gap if you only hold forward, at about 0.6 s of good let-go time. Leaning in time gives it 1.7 s.</p>
    <p style="margin-top:16px">Not checked:</p>
    <ul class="what open">
      <li>How it feels in your hands. If the first swings feel too slow, there is a single number for that: <code>pumpStart</code>, the strength of the push from a standstill.</li>
    </ul>
    <div class="files">
      <div><b><code>app/src/player.js</code></b><span>The lean pushes along the arc, scaled by swing speed (<code>pumpRef</code>, <code>pumpStart</code>) and faded near horizontal. The thread pays out while she rolls over a lip.</span></div>
    </div>
  </div>
'''
print(page('swinghang', 'Spindledeep · A Swing Has to Be Earned', body, PREV))

# ── page 2: hidden rooms ──────────────────────────────────────────────────
D = os.path.join(HERE, 'secrets', 'img')
rooms = [
    ('cellar', 'The Cellar', 'The Brink', 'a wooden spool',
     'At the far west edge of the Brink, behind the cottage, there is a slit in the moonlit ground. Walk into it and a steep ramp takes you down to a room under her yard. Jump the slit to get back across.'),
    ('cache', "The Diggers' Cache", 'The Throat', 'a brass coat button',
     'At the far end of the second ledge down, where the ledge runs into the east wall, a crawl hole about the doll’s height goes on into the rock.'),
    ('seeds', 'The Seed Hollow', 'The Root Gardens', 'a packet of seeds',
     'Low in the west corner of the second garden, a step past the peg, a crack slopes down out of sight. You can walk down and back up.'),
    ('cell', "The Ringer's Cell", 'The Bell Gallery', 'a silver thimble',
     'Where the west ledge meets the gallery wall, behind the great bell, a low crawl leads to a small room with candles.'),
    ('sill', 'The Sill', 'The shaft into the Mere', 'a spare button eye',
     'Halfway down the shaft a lip of rock sticks out of the east wall. Lower yourself to it on the thread, pump a few swings toward it and let go over the lip. This one uses the new swing.'),
    ('loom', 'The Last Basket', 'The Loom', 'a half-knitted mitten',
     'Where the Loom’s floor meets its east slope, a crawl runs along the floor into the rock.'),
]
for k, *_ in rooms:
    jpg(f'before_{k}.png', D, f'{k}_before.jpg')
    jpg(f'after_{k}.png', D, f'{k}_after.jpg')
    jpg(f'in_{k}.png', D, f'{k}_inside.jpg')
sec = ''
for k, name, area, what, how in rooms:
    sec += f'''
  <h2>{name}</h2>
  <div class="col">
{reveal(k, f'{k}_before.jpg', f'{k}_after.jpg', f'Before: {area}, plain rock where the crack will be', f'After: {area}, the same view with the narrow mouth of the crack in the rock')}    <p><b>{area}.</b> {how}</p>
    <figure class="solo"><img src="img/{k}_inside.jpg" alt="Inside {name}: the room lit by the doll's thread, its keepsake glinting on the floor"><figcaption>Inside, once found: {what}</figcaption></figure>
  </div>
'''
body = hero('new secrets', 'Six Hidden Rooms', 'Narrow cracks off the beaten way', 'and a keepsake of hers in each') + f'''
  <div class="col summary">
    <p>There are six hidden rooms now, one in each part of the descent. Each starts as a narrow crack in an out-of-the-way spot: the far end of a ledge, a low corner, a lip of rock halfway down a shaft. You can see the mouth if you look, but it's easy to walk past.</p>
    <p>Each room is drawn as solid rock until the doll first steps inside. Then the room opens up, its name comes up like an area title, and a small keepsake of the knitter's is waiting on the floor.</p>
  </div>

  <h2>What you find</h2>
  <p class="ask">Please add some hidden rooms or tunnels which lead to some interesting small rooms and maybe some collectibles. These hidden tunnels should be visible but hard to notice so that it's still interesting and challenging.</p>
  <div class="col">
    <ul class="what">
      <li><b>Visible but hard to notice.</b> Only the first metre or two of each crack is drawn. The rest of the tunnel, the room and everything in it stay rock until you walk in, so nothing gives the room away from a distance, not even its light. In a first version the full room outlines showed through the rock in the engraving, which gave every secret away, so this hiding was added.</li>
      <li><b>Keepsakes.</b> A wooden spool, a brass coat button, a packet of seeds, a silver thimble, a spare button eye and a half-knitted mitten. Each has a line of its own when you pick it up, plus a count (“keepsake 3 of 6”).</li>
      <li><b>They're remembered.</b> Found rooms and keepsakes are saved with the rest of your progress, and the credits list how many you found.</li>
      <li><b>Each room has a past,</b> dressed with the same kind of props as the rest of the deep: baskets of yarn, a miner's lantern and bucket, garden markers and mushroom pots, candles and a toppled stool, a stack of letters and a pair of boots.</li>
    </ul>
    <p style="margin-top:14px">In each slider below, the before is the same view in the old build. Drag to see how little of the crack shows. Under it is the room once you've walked in.</p>
  </div>
{sec}
  <h2>How it was checked</h2>
  <div class="col">
    <ul class="what">
      <li><b>Every room was walked in the game's physics,</b> in and back out: from the nearest peg to the keepsake and back to the main route. The Sill was done the hard way: drop into the shaft, lower on the thread, pump, let go over the lip and walk in. That took 14.6 s.</li>
      <li><b>The flood fill</b> from the cottage still reaches every peg, skein, memory and the final scene, and now all six keepsakes too.</li>
      <li><b>The route down the shaft still works.</b> The lip narrows the shaft to about 3.3 m, and a doll dropped from the east ledge still lands on the Mere shore and ties the peg there.</li>
      <li><b>The cracks can't close up.</b> The noise that roughens the rock edges is kept gentle around each crack, so it can't seal a narrow passage.</li>
    </ul>
    <p style="margin-top:16px">Not checked:</p>
    <ul class="what open">
      <li>Whether the cracks are too hard or too easy to spot in a real playthrough. Each one is a single spot in <code>level.js</code> if it needs widening or hiding better.</li>
    </ul>
    <div class="files">
      <div><b><code>app/src/level.js</code></b><span>The six cracks and rooms, the gentle-noise zones, and the list of rooms with their keepsakes.</span></div>
      <div><b><code>app/src/terrain.js</code></b><span>Gentle noise near the cracks, and a separate drawn version of the rock with unfound rooms filled in, patched locally when one is found.</span></div>
      <div><b><code>app/src/world.js</code></b><span>Finding a room, picking up a keepsake, and a faint glint once the room is open.</span></div>
      <div><b><code>app/src/props.js</code></b><span>Drawings of the six keepsakes, and props dressing the rooms.</span></div>
      <div><b><code>app/src/main.js</code></b><span>Room titles, sounds, saving, and the credits line.</span></div>
      <div><b><code>app/src/renderer.js</code></b><span>Uploading and patching the drawn rock.</span></div>
    </div>
  </div>
'''
extra = PREV + (f' &middot; <a href="{LINK_SWING}">a swing has to be earned</a>' if LINK_SWING else '')
print(page('secrets', 'Spindledeep · Six Hidden Rooms', body, extra))
