import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal


def build(d):
    body = hero('after the titles', 'No Two Stones', 'the rock breaks unevenly', 'and the cave is heard')
    body += f'''
  <div class="col summary">
    <p>Three changes to the film after the bitten ending&rsquo;s titles. The rock no longer repeats: it bulges and hollows, its layers wander and give out, and it breaks into blocks of every size. The cave has its own sound under the names now. And the doll&rsquo;s head is grey wool again instead of a white blot.</p>
  </div>

  <h2>What changed</h2>
  <p class="ask">Add more cave ambience and make the rocks even more uneven, it looks too artificial now. Also why is the doll&rsquo;s head white?</p>
  <div class="screen"><video controls playsinline preload="metadata" poster="img/a300.jpg"><source src="vid/names_720.mp4" type="video/mp4"></video>
    <p class="reveal-cap">The whole film, {d['len']} seconds, with sound</p></div>

  <h2>Uneven rock</h2>
  <div class="col">
''' + reveal('r300', 'b300.jpg', 'a300.jpg', 'Before: even bands of ledges across the wall', 'After: outcrops, hollows and broken blocks') + '''
    <p class="reveal-cap">Halfway through. Before: the last version, with evenly spaced ledges</p>
    <ul class="what">
      <li><b>Why it looked artificial.</b> The ledges were spaced evenly up the wall and the cracks evenly round it, so the rock repeated like a pattern.</li>
      <li><b>Outcrops and hollows.</b> Big, random swellings and dents half a metre deep, different everywhere.</li>
      <li><b>Layers that wander.</b> The layers of rock bend up and down, thicken and thin, and some of them simply stop; how far each one juts out is random.</li>
      <li><b>Blocks of every size.</b> The rock is cracked into irregular cells, and each block stands out from the wall by its own amount, so faces step against each other.</li>
      <li><b>The crawl still holds.</b> Along its route the big swellings are damped (its hands have worn a way). Hands and feet don&rsquo;t slide or fall short, and the closest any part of it comes to the rock is 14 mm.</li>
    </ul>
  </div>

  <h2>The doll&rsquo;s head</h2>
  <div class="col">
''' + reveal('r60', 'b60.jpg', 'a60.jpg', 'Before: the head blown out to white', 'After: grey wool with its lines') + '''
    <p class="reveal-cap">Near the start, when the camera is closest</p>
    <p>The head is grey wool, but in this film it was about ten times brighter than the floor around it. The wool is much lighter than the rock, its sheen catches the light, and the light from the well falls straight onto its top. In the engraving, anything that bright becomes bare paper, so the head had no lines left and read as white. Dimming the light didn&rsquo;t help: the floor went with it. So in this film only, the wool is darker and has less sheen (damp and dusty at the bottom of the well). The head comes out grey with its knit lines, still the lightest thing in the cave.</p>
  </div>

  <h2>The cave&rsquo;s sound</h2>
  <div class="col">
    <p>Under the names, the crawling and the far-off tune there was only a low bed, a few drips and a breath. Now the cave has layers of its own. Everything in it carries the same three-part echo off the walls.</p>
    <div class="tablebox"><table class="windows"><tr><th>Layer</th><th>What you hear</th></tr>
      <tr><td>Cave air</td><td>The cave&rsquo;s own tone, all the way through</td></tr>
      <tr><td>Far end</td><td>Deep air from further in, very low</td></tr>
      <tr><td>Drips</td><td>A drop every 1 to 3 seconds, near or far, left or right</td></tr>
      <tr><td>Water</td><td>A trickle off to the right early on, another to the left later</td></tr>
      <tr><td>Falling grit</td><td>Four times, dirt or pebbles let go somewhere up the walls</td></tr>
      <tr><td>The rock settling</td><td>Once, a long low rumble far away</td></tr>
    </table></div>
    <p class="reveal-cap">Nothing drones and nothing plays as music; the sound is still exactly on the movement (0.0 ms)</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The film</b><span><code>app/assets/cine/names.mp4</code></span></div>
    <div><b>Rock, doll, light</b><span><code>scripts/cine/shots_end.py</code> (<code>N1</code>)</span></div>
    <div><b>The sound</b><span><code>scripts/cine/edit.py</code> (<code>names_sound</code>)</span></div>
  </div></div>
'''
    style = '''<style>
    .screen { max-width: 1040px; margin: 34px auto 18px; }
    .screen video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .reveal-cap { margin-top: 10px; }
  </style>
'''
    return page('cavesound', 'No Two Stones: after the titles', style + body, d.get('extra', ''))


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
