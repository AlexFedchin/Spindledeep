"""Changes page: smooth rock, its kinds, the dark, the thread's light, the Hush, quiet places, her movements, creatures, checks (`worn/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/5uSdDNUyBLywtGkXhW31me">the trailer</a>'
        ' &middot; <a href="https://claude.ai/artifact/2MbbE57vopQ11jGfd8ZGi4">drawn</a>')
CSS = '''  <style>
    .wide { max-width: 900px; margin: 0 auto; }
    .fig { margin: 8px 0 26px; }
    .fig img { display: block; width: 100%; height: auto; border: 1px solid var(--rule); }
    .fig figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); margin-top: 10px; }
    details.seal { max-width: 900px; margin: 34px auto; border: 1px solid var(--rule); padding: 18px 22px; }
    details.seal summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
    details.seal summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    details.seal[open] summary { margin-bottom: 22px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''


def rv(i, b='Before', a='Now'):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


def fig(n, cap, alt):
    return f'  <div class="wide"><figure class="fig"><img src="img/{n}.jpg" alt="{alt}"><figcaption>{cap}</figcaption></figure></div>\n'


body = CSS + hero('seventeen points', 'Worn', 'Rock worn smooth', 'and a light to carry') + '''
  <p class="ask">do the points 1, 2, 3, 4, 5, 7, 9, 10, 11, 13, 14, 15, 16, 20, 23, 24, 25.</p>

  <h2>The rock</h2>
  <div class="col">
    <ul class="what">
      <li><b>No more steps.</b> The cave was cut on a yes/no grid of 12.5&nbsp;cm cells, and gentle slopes showed its stairs. The edge now keeps its exact place inside each cell, and is drawn with a smooth curve. She stands on the same edge you see, and both threads lie on it, without the little spikes.</li>
      <li><b>Worn corners.</b> Ledge lips, pit mouths and pillars are rounded, and the planed floors of the newer rooms rise and dip by a few centimetres.</li>
      <li><b>No seams.</b> The engraved lines bend where two faces meet instead of breaking along a hard diagonal, and light spreads as it goes into the ground instead of stopping at a straight edge.</li>
    </ul>
  </div>
''' + rv('edge') + rv('seam') + '''
  <h2>A rock for each place</h2>
  <div class="col">
    <p>Frozen earth on the Brink, split stone in the Throat, earth and roots in the Gardens, columns in the Bell Gallery, wet stone round the Mere, shale in the Hall, packed soil in the Hush, hewn rock in the Treadles, and felt in the Loom. Each has its own broken edge, its own cracks or fibres, and its own way for the lines to run. They change into each other over a few metres.</p>
  </div>
''' + rv('throat') + rv('bell_mid') + rv('gardens') + rv('lane') + '''
  <h2>The dark</h2>
  <div class="col">
    <ul class="what">
      <li><b>Something in it.</b> Every edge carries a breath of its place&rsquo;s own light, further caves stand behind the near ones with a thin haze between, and about a hundred weak lights grow on the rock: frost, caps, lichen, candle ends, embers, pale threads.</li>
      <li><b>Not brighter.</b> Most views came out slightly darker overall than before, because the deep rock is now properly black.</li>
      <li><b>Lines that rest.</b> The lines over empty air hang in the cave instead of on the screen. They sag and swell, break up in the dark, and stop where it is black.</li>
    </ul>
  </div>
''' + rv('mere') + rv('title') + '''
  <h2>The thread&rsquo;s light</h2>
  <div class="col">
    <ul class="what">
      <li><b>Knot a light (E).</b> With nothing else to do there, E ties a light into the thread and leaves it burning. It holds 5&nbsp;m of yarn until you walk back past it or tie on at a pole, where it stays for good. Up to three at once. Moths circle it and leave the thread alone, and a hand in the Hush will close on it instead of you.</li>
      <li><b>Dim it (hold Q, or LB).</b> The thread and the doll go almost dark for a few breaths. Moths lose her, the hands feel her from less far and strike where she was, and what follows the thread is slower. Your eyes also get used to the dark, so everything with a light of its own shows brighter.</li>
    </ul>
  </div>
''' + fig('g_knot', 'a knot of light left on the thread', 'A glowing red bow on the thread between a pole and the doll') + '  <div class="wide">\n' + reveal('dim', 'g_lit.jpg', 'g_dim.jpg', 'The Orchard by the thread', 'The Orchard with the thread dimmed', 'Lit', 'Dimmed') + '  </div>\n' + '''
  <h2>The Hush</h2>
  <div class="col">
    <p>Plucking rouses the earth, and it forgets slowly. Roused, the hands are quicker, reach further, come three at a time, keep a better hold, and one that missed moves along under the rock to come out nearer. Crumbs fall behind you while it is awake. Dimming and knotted lights are the quiet answers. Stopping dead still makes one miss, but in the long gallery it is not enough alone, as before. Bots crossing the long gallery, twelve runs each:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>How they cross</th><th>Through, before</th><th>Through, now</th><th>Lowest yarn, before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>Pluck to a rhythm, whatever happens</td><td>12 of 12</td><td>0 of 12</td><td>67</td><td>60</td></tr>
          <tr><td>Hammer the thread</td><td>12 of 12</td><td>12 of 12</td><td>67</td><td>29</td></tr>
          <tr><td>React to a warning, tear free</td><td>12 of 12</td><td>12 of 12</td><td>67</td><td>42</td></tr>
          <tr><td>Never pluck until seized</td><td>12 of 12</td><td>12 of 12</td><td>50</td><td>61</td></tr>
          <tr><td>Dim when one stirs</td><td>new</td><td>12 of 12</td><td>new</td><td>74</td></tr>
        </tbody>
      </table>
    </div>
    <p>Dimming is the strongest answer, at the price of hardly seeing the pits. Once you have played it I can make it weaker.</p>
  </div>

  <h2>Quiet places</h2>
  <div class="col">
    <p>Two large new places lie off the way down, one by the Root Gardens and one before the Treadles. Nothing hunts you there. Each has a pole, and a skein at the far end. Seven seats stand in the game: sit down (E) and the view opens out, the small lights come up and the beasts come out. Both places were walked in, to the end and out again by a bot with the yarn she has, in both modes.</p>
  </div>
''' + fig('g_sit', 'the orchard, sitting', 'A wide cave with trees growing down from the roof, bearing pale fruit') + '''
  <details class="seal">
    <summary>Sealed: the other place</summary>
''' + fig('g_long', 'the long room', 'A long low room hung with lines of cloth') + '''  </details>

  <h2>Her, the rock and the beasts</h2>
  <div class="col">
    <ul class="what">
      <li><b>Falling.</b> In a long drop the view goes ahead of her, so you see what is coming.</li>
      <li><b>The doll.</b> Her feet find the ground on a slope. She teeters at an edge, stumbles after a hard landing, leans on a wall, cups the light when she dims it, and trembles when something has stirred. Left alone she looks about, then sits down and winds yarn. Below the Hush she only looks over her shoulder.</li>
      <li><b>The rock answers.</b> Grit jumps from landings and from the thread as it is plucked, and dust sifts out of the roof after hard landings, stamps, doors and the heaving dark.</li>
      <li><b>Beasts.</b> Crows, bats, beetles, fireflies, mice, and something under the ink that follows your light. They run from noise and quick movement and come nearer when you are still. From the Hush down there are no beasts, only loose ends of thread that turn toward you.</li>
    </ul>
  </div>
''' + fig('g_idle', 'left alone for a while, with a firefly', 'The doll sitting beside a pole, winding yarn, a firefly by her face') + '''
  <h2>Very wide windows</h2>
  <div class="col">
    <p>At 21:9 the view comes a little nearer so she is not lost in it, and the paintings go on past their sides and fade instead of ending.</p>
  </div>
''' + rv('wide') + '''
  <h2>Under the hood</h2>
  <div class="col">
    <ul class="what">
      <li><b>Picture check.</b> One command draws 38 views with the working version and with any older one, and lists how much each changed and where. Every before-and-after here came out of it.</li>
      <li><b>Logs.</b> Each stretch between two poles is logged with its time, tries, deaths, lowest yarn, and how often you plucked, dimmed and knotted. A script adds them up over all sessions. 40 logs are kept instead of 10.</li>
      <li><b>Smaller, but not by much.</b> The models went from 49 to 19&nbsp;MB and the paintings and sprites from 13.5 to 7.9&nbsp;MB without loss. The films could not shrink: their fine lines made almost every re-encode I tried larger than the file it came from, and the best one saved 5&nbsp;%, so they are untouched. Most of the rest is Electron itself.</li>
    </ul>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th></th><th>1.1.0</th><th>1.2.0</th></tr></thead>
        <tbody>
          <tr><td>Portable</td><td>277.0 MB</td><td>269.4 MB</td></tr>
          <tr><td>Installer</td><td>287.2 MB</td><td>279.7 MB</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>What was checked</h2>
  <div class="col">
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Check</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>Whole game by bot, plain and frayed</td><td>reaches the choice</td><td>reaches the choice</td></tr>
          <tr><td>The 12 ring gaps, release moments that land (of 48)</td><td>tightest 6</td><td>tightest 16</td></tr>
          <tr><td>Thread inside rock</td><td>8 of 28029 frames</td><td>0 of 28009</td></tr>
          <tr><td>The six rooms, shelves, hidden rooms</td><td>pass</td><td>the same results, within one try</td></tr>
          <tr><td>Speed at 2560&times;1440</td><td>58 fps</td><td>58 fps</td></tr>
        </tbody>
      </table>
    </div>
    <p>The whole-game bot used to let go of a ring at a fixed moment. It now judges its release by where it would land, so its run is shorter and its death count can&rsquo;t be compared with older pages. I can&rsquo;t hear the new sounds or judge how the dimming and the sitting feel in the hand, so those need you.</p>
  </div>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/terrain.js</code></b><span>The rock: exact edges, wear, the field the lines follow.</span></div>
      <div><b><code>app/src/shaders.js</code></b><span>Kinds of rock, far caves, the lines.</span></div>
      <div><b><code>app/src/kindle.js</code></b><span>Knots of light, dimming, sitting.</span></div>
      <div><b><code>app/src/life.js</code></b><span>Weak lights and beasts.</span></div>
      <div><b><code>scripts/checks/pics.py</code></b><span>The picture check.</span></div>
      <div><b><code>scripts/checks/logs.py</code></b><span>What the logs say.</span></div>
    </div>
  </div>
'''
print(page('worn', 'Spindledeep · Worn', body, PREV))
