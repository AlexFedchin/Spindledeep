import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal

# gap between her skin and the doll (mm) while she lifts it: old film (Blender's own meshes), new film (touch.py)
OLD = [(65, 134.7), (69, 89.6), (73, 36.4), (77, -11.1), (81, -46.9), (85, -57.2), (89, -60.2), (93, -60.2), (97, -60.4), (101, -60.6), (105, -60.2), (109, -58.3), (113, -54.9), (117, -50.5), (121, -45.3), (125, -39.7), (129, -34.4), (133, -29.7), (137, -26.1), (141, -23.8)]
OLDL = [(65, 189.2), (69, 128.1), (73, 94.1), (77, 71.3), (81, 59.7), (85, 50.9), (89, 48.6), (93, 48.6), (97, 48.3), (101, 47.8), (105, 47.5), (109, 47.7), (113, 48.4), (117, 49.6), (121, 51.4), (125, 53.5), (129, 55.9), (133, 58.0), (137, 59.7), (141, 60.7)]


def gap_chart():
    W, H, l, r, t, b = 640, 250, 46, 12, 14, 30
    X = lambda f: l + (f - 85) / (141 - 85) * (W - l - r)
    Y = lambda mm: t + (70 - mm) / 140 * (H - t - b)
    g = ''
    for mm in (60, 30, 0, -30, -60):
        g += f'<line x1="{l}" x2="{W - r}" y1="{Y(mm):.1f}" y2="{Y(mm):.1f}" stroke="{"#a99f8c" if mm == 0 else "#2c2832"}" stroke-width="1"/><text x="{l - 8}" y="{Y(mm) + 4:.1f}" fill="#a99f8c" font-size="11" text-anchor="end" font-family="IBM Plex Mono, monospace">{mm:+d}</text>'
    for s in (0, 0.5, 1, 1.5, 2):
        f = 89 + s * 24
        if f <= 141:
            g += f'<text x="{X(f):.1f}" y="{H - 8}" fill="#a99f8c" font-size="11" text-anchor="middle" font-family="IBM Plex Mono, monospace">{s:g} s</text>'
    line = lambda pts, c, d='': f'<polyline points="{" ".join(f"{X(f):.1f},{Y(v):.1f}" for f, v in pts if f >= 85)}" fill="none" stroke="{c}" stroke-width="2" {d}/>'
    g += line(OLDL, '#a99f8c') + line(OLD, '#a99f8c', 'stroke-dasharray="5 4"') + f'<line x1="{X(85)}" x2="{X(141)}" y1="{Y(-0.6):.1f}" y2="{Y(-0.6):.1f}" stroke="#d8262c" stroke-width="3"/>'
    return f'''<div class="chart"><p class="legend"><span><i style="background:#a99f8c"></i>before, left hand</span><span><i style="background:repeating-linear-gradient(90deg,#a99f8c 0 5px,transparent 5px 9px)"></i>before, right hand</span><span><i style="background:#d8262c"></i>now, both hands</span></p>
<svg viewBox="0 0 {W} {H}" role="img" aria-label="Millimetres between her hands and the doll while she lifts it">{g}</svg></div>'''


def build(d):
    body = hero('the opening film', 'By Hand', 'her hands on the wool', 'her boots in the snow')
    body += f'''
  <div class="col summary">
    <p>The opening film has been staged again, {d['len']} seconds in all. She knits stitch by stitch, sews the eye on, ties the thread, carries the doll to the sill and sets it down. Her hands rest on what they hold, she walks on her own legs, every camera moves in a straight line at one speed, and each sound is placed by the same numbers that move the picture.</p>
  </div>

  <div class="screen"><video controls playsinline preload="metadata" poster="img/sill_after.jpg"><source src="vid/prologue_720.mp4" type="video/mp4"></video>
    <p class="reveal-cap">The whole film, with sound</p></div>

  <h2>The knitting</h2>
  <p class="ask">make more detailed moves in the knitting scene</p>
  <div class="col">
    <figure class="solo wide"><video muted loop playsinline autoplay preload="metadata" poster="img/knit.jpg"><source src="vid/knit.mp4" type="video/mp4"></video><figcaption>A new shot: the needle in, the yarn round, the loop through, the old one off.</figcaption></figure>
    <ul class="what">
      <li><b>One stitch has four moves,</b> and each is a different movement of needle, wrist or forefinger. The piece hangs from the needles loop by loop and swings a little behind her hands.</li>
      <li><b>The eye is sewn on properly.</b> The needle goes in under the button, her fingers let go and take it by the point on the other side, and the red thread is drawn through and pulled tight. Her left hand holds the head and the doll gives with each tug.</li>
    </ul>
''' + reveal('eye', 'eye_before.jpg', 'eye_after.jpg', 'Before: hands hovering beside the doll', 'After: one hand cups the head, the other works the needle') + '''
  </div>

  <h2>Hands that touch</h2>
  <p class="ask">make sure the hands are touching the doll, not inside, not hovering, but touching, and the dolls moves together with hands</p>
  <div class="col">
''' + reveal('lift', 'lift_before.jpg', 'lift_after.jpg', 'Before: one hand inside the doll, one beside it', 'After: both hands closed on its sides') + f'''
    <p>Her skin is now fitted to the wool. The palm is brought up until it meets the surface, then every finger closes joint by joint until its own skin does, and the thumb last. After that the hand is fixed to the doll, so they move as one thing. In the old film one hand floated 5 cm away and the other was sunk 6 cm into the doll.</p>
    {gap_chart()}
    <p class="reveal-cap">Millimetres between skin and doll while she lifts it; below zero is inside</p>
    <div class="tablebox"><table class="windows"><tr><th>What she holds</th><th>Frames</th><th>Skin to surface, the whole hold</th></tr>
      <tr><td>Knitting needles</td><td class="n">156</td><td class="n">&minus;0.6 mm</td></tr>
      <tr><td>The doll&rsquo;s head while sewing</td><td class="n">210</td><td class="n">&minus;0.8 mm</td></tr>
      <tr><td>The sewing needle, whenever it is pinched</td><td class="n">&ndash;</td><td class="n">&minus;1.3 to +0.1 mm</td></tr>
      <tr><td>The thread she pulls tight</td><td class="n">93</td><td class="n">&minus;0.1 to +0.1 mm</td></tr>
      <tr><td>The doll, lifted from the table</td><td class="n">73</td><td class="n">&minus;0.8 to &minus;0.4 mm</td></tr>
      <tr><td>The doll, set on the sill</td><td class="n">126</td><td class="n">&minus;0.8 to &minus;0.4 mm</td></tr>
      <tr><td>Her hand on its head</td><td class="n">29</td><td class="n">&minus;0.8 to &minus;0.5 mm</td></tr>
      <tr><td>The lantern&rsquo;s handle</td><td class="n">416</td><td class="n">&minus;0.7 mm</td></tr></table></div>
    <p class="reveal-cap">Nearest point of the hand to what it holds; the wool gives up to 0.8 mm</p>
    <figure class="solo wide"><video muted loop playsinline autoplay preload="metadata" poster="img/sill_after.jpg"><source src="vid/sill.mp4" type="video/mp4"></video><figcaption>The sill is a shot of its own now. Before, the film cut from the lift to the doll already standing there.</figcaption></figure>
  </div>

  <h2>She walks</h2>
  <p class="ask">when the knitter exits the house she should be actually walking, not just flowing</p>
  <div class="col">
''' + reveal('walk', 'walk_before.jpg', 'walk_after.jpg', 'Before: a stiff figure gliding over the snow', 'After: mid-stride, in profile, with footprints behind her') + '''
    <figure class="solo wide"><video muted loop playsinline autoplay preload="metadata" poster="img/walk_after.jpg"><source src="vid/walk.mp4" type="video/mp4"></video><figcaption>Seen from the side, to the lip of the pit and down its steps.</figcaption></figure>
    <ul class="what">
      <li><b>Each foot is planted</b> and stays where it was put until its heel lifts. Hips drop, sway and turn over the standing leg. The furthest any foot falls short of its footprint is 0.0 mm.</li>
      <li><b>At the door</b> she stops, lays her palm on it and pushes; the wind takes it out of her hand. The snow comes in only after that.</li>
      <li><b>Outside</b> she leaves prints, the lantern swings with her steps, and she goes down stone steps into the pit instead of sinking.</li>
    </ul>
''' + reveal('door', 'door_before.jpg', 'door_after.jpg', 'Before: she slides through the doorway', 'After: she steps out over the threshold') + f'''
  </div>

  <h2>The flicker</h2>
  <p class="ask">there is also some flickeing seen outside when she exits. Fix it.</p>
  <div class="col">
    <p>There were five causes, and each has been dealt with.</p>
    <ul class="what">
      <li><b>The light in the doorway.</b> It stood where she walks, so her own body shut it off and the picture blinked dark for a moment. It now comes from above the eaves.</li>
      <li><b>Lines that turned with the camera.</b> The engraved lines on the snow followed the camera&rsquo;s heading and crawled whenever it panned. They are fixed to the ground now.</li>
      <li><b>Lines strobing.</b> Pushing toward the snow swept the lines past faster than 24 frames can show. Outside, the camera now tracks sideways along them, so they stand still.</li>
      <li><b>Coarse positions.</b> Out by the pit, positions were stored in steps of up to 16 mm, which broke the lines into crawling dashes. They are stored finely now, in every shot.</li>
      <li><b>Blinking flakes.</b> A flake&rsquo;s stroke was shorter than the way it flies in one frame. It is as long now.</li>
    </ul>
    <div class="tablebox"><table class="windows"><tr><th>Shot</th><th>Flicker before</th><th>Now</th></tr>{d['flick']}</table></div>
    <p class="reveal-cap">Average back-and-forth change per pixel (0 to 255), falling snow included</p>
    <p>By the pit, measured only where no flakes fall, flicker went from 64 to 9 at full size.</p>
  </div>

  <h2>The camera</h2>
  <p class="ask">in every shot the camera movement should not have an ease-in-out smoothing, it should be just linear</p>
  <div class="col">
    <p>All eleven moves run in a straight line at one speed from the first frame to the last, and the hand-held drift is gone. Within any shot, the fastest and slowest frames differ by at most 0.003 mm. This covers the opening film only.</p>
  </div>

  <h2>The sound</h2>
  <p class="ask">All the sounds should play in perfect sync with the movements. Also the magic sounds when the doll starts to move it super cringe, replace it pls</p>
  <div class="col">
    <ul class="what">
      <li><b>The film&rsquo;s {d['nev']} sounds are written by the movement itself.</b> When a needle meets the other, a heel lands or the doll&rsquo;s feet reach the sill, the shot notes that frame, and the moment of contact inside the recording is laid on it.</li>
      <li><b>Checked in the finished file:</b> {d['sync']}</li>
      <li><b>No more harp and chimes.</b> When the doll wakes, the storm outside drops away and all that is left is wool: a stuffed neck being turned, an arm, then the mitten closing on the thread and the thread coming tight. The title&rsquo;s chimes and the one at the candle are gone too.</li>
      <li><b>New recordings,</b> all CC0: knitting with metal needles, a needle going through cloth, wool, an old cottage door, a shed latch and an oil lantern.</li>
    </ul>
''' + reveal('wake', 'wake_before.jpg', 'wake_after.jpg', 'Before: the doll in profile', 'After: the doll behind the glass, its mitten on the thread') + '''
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The film</b><span><code>app/assets/cine/intro.mp4</code></span></div>
    <div><b>The shots</b><span><code>scripts/cine/shots_intro.py</code></span></div>
    <div><b>Hands and feet</b><span><code>scripts/cine/act.py</code>, checked by <code>touch.py</code></span></div>
    <div><b>Sounds</b><span><code>scripts/cine/foley.py</code>, checked by <code>synccheck.py</code></span></div>
    <div><b>Render</b><span><code>scripts/cine/render_intro.sh</code>, stills with <code>pv.sh</code></span></div>
  </div></div>
'''
    style = '''<style>
    .screen { max-width: 1040px; margin: 34px auto 18px; }
    .screen video, .solo video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    .solo.wide { max-width: 680px; }
    video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .reveal-cap { margin-top: 10px; }
  </style>
'''
    return page('prologue', 'By Hand: the opening film', style + body, ' &middot; <a href="https://claude.ai/artifact/W7jrYmxMZJTfqAj1wYvMeW">rough</a>')


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
