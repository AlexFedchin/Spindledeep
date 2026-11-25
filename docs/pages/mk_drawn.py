"""Changes page: drawn collectibles, the chase, stories and sounds of the rooms, the playthrough bot, release (`drawn/`). Plot sealed."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/JVz86QFmxLkkRDhP4QLHUn">further</a>'
        ' &middot; <a href="https://claude.ai/artifact/1Nw7Pg3WD3HzuWupWjqqWn">things</a>')
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


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


def fig(n, cap, alt):
    return f'  <div class="wide"><figure class="fig"><img src="img/{n}.jpg" alt="{alt}"><figcaption>{cap}</figcaption></figure></div>\n'


body = CSS + hero('drawn, not modelled', 'Drawn', 'Flat things again', 'and something on the thread') + '''
  <p class="ask">I actually like that everything looks 2D, I would probably ask you to even make the collectibles kind of like 2-2.5D, I don't know how though. The game is not supposed to be super realistic, it has its visual styles and super detailed 3d models do not fit. So please do points 2, 4, 5, 6 (actually the whole loom chase should be more intense) and 9. Point 3 do with my comments.</p>

  <h2>The collectibles, drawn</h2>
  <div class="col">
    <ul class="what">
      <li><b>Flat tones and ink.</b> Each thing is now one flat grey with three steps of light, an ink outline as thick as the doll&rsquo;s, and the same hatching. Nothing reflects any more.</li>
      <li><b>What is on them is ink too.</b> Writing, scratches, pits and stitches are drawn as lines, so you can still read them.</li>
      <li><b>No colour but the thread&rsquo;s.</b> Only red yarn is red.</li>
      <li><b>Two and a half dimensions.</b> They rock a little like a thing cut out of card. The mouse can tip one, but not turn it round, and it swings back when you let go.</li>
      <li><b>The same everywhere.</b> Held up, lying in the caves and on her shelf.</li>
    </ul>
  </div>
''' + rv('skein', 'Before: the realistic ball of yarn', 'Now: drawn') + rv('thimble', 'Before: the realistic thimble', 'Now: drawn') + rv('button', 'Before: the realistic button', 'Now: drawn') + rv('seeds', 'Before: the realistic packet', 'Now: drawn') + '''
  <details class="seal">
    <summary>Sealed: the other five. What is on them is part of the story</summary>
''' + rv('spool', 'Before', 'Now') + rv('eye', 'Before', 'Now') + rv('mitten', 'Before', 'Now') + rv('pattern', 'Before', 'Now') + rv('shoe', 'Before', 'Now') + '''  </details>

  <h2>The Loom chase</h2>
  <div class="col">
    <ul class="what">
      <li><b>It follows your thread.</b> What used to crawl up the far wall now comes hand over hand along the thread you have laid, and kills when it reaches you. A pluck shakes it back down, less far each time, and costs yarn.</li>
      <li><b>The dark heaves.</b> It stays closer than before, and every eight and a half seconds it gathers itself and lunges. Your thread goes out where it has closed over it.</li>
      <li><b>A longer way.</b> Instead of straight up, the climb now goes out across the Loom over strips of cloth that tear away under you, up a third rope on the far side, and back along the top. There are five new poles.</li>
      <li><b>Three tools at once.</b> The way back is a machine: wind in a handle to lift a door, get past a bobbin by fouling it on your thread, then hang from a sinking ring over the dark to lift the last door.</li>
    </ul>
  </div>
''' + fig('l_n2', 'on the thread, behind her', 'A long-limbed figure hauling itself along the red thread toward the doll') + fig('l_gap', 'the machine &middot; the bobbin, the sinking ring and its door, the dark below', 'A bobbin wound with thread, a ring over a gap, and hands rising out of the dark') + '''
  <h2>Story and sound for the new rooms</h2>
  <div class="col">
    <p>The rooms under the Hall, round the Hush and below the Treadles now have one knot of her voice and one hidden room per pair, each with a keepsake. There are eleven keepsakes now, and the reward for finding them all needs all eleven. The shelf has room for them. Each of the six rooms has its own quiet noises. The ratchets, the bobbin, the spindles and the heaving dark have sounds made for them. Everything is a single short sound and nothing lasts.</p>
  </div>
  <details class="seal">
    <summary>Sealed: the three lines and the three new keepsakes</summary>
    <div class="col">
      <ul class="what">
        <li><b>Under the Hall.</b> &ldquo;They sat in rows down here, little one, and said them aloud. The names of everyone they had lost. They thought that they were praying.&rdquo;</li>
        <li><b>Round the Hush.</b> &ldquo;When it moves in the walls, be still. I was still for a whole winter, once. It sat beside me the whole time.&rdquo;</li>
        <li><b>Below the Treadles.</b> &ldquo;I can hear you coming down. Such small feet. ...I never gave you feet that make a sound.&rdquo;</li>
      </ul>
    </div>
''' + fig('weight', 'the Tally', 'An iron weight with scratches') + fig('tag', 'the Held Breath', 'A luggage tag with the name cut out') + fig('scissors', 'the Cut', 'Embroidery scissors with one point snapped off') + '''  </details>

  <h2>A bot that plays the whole game</h2>
  <div class="col">
    <p>It starts at the cottage and goes pole to pole to the choice at the top, in one world, with the real thread, hands, machines and the chase. When it dies it tries again, as a person would. It paid for itself at once: one strip of cloth had the same name as the veil in the Root Gardens, so in a real run it would already have been torn away when you arrived, and no test of a single room could have shown that. It also showed that two ropes hung too high to catch from the floor.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Run</th><th>Reached the choice</th><th>Time</th><th>Deaths</th></tr></thead>
        <tbody>
          <tr><td>Plain, first seed</td><td>yes</td><td>10.7 min</td><td>15</td></tr>
          <tr><td>Plain, second seed</td><td>yes</td><td>10.4 min</td><td>12</td></tr>
          <tr><td>Plain, third seed</td><td>yes</td><td>10.3 min</td><td>14</td></tr>
          <tr><td>Frayed, three seeds</td><td>yes</td><td>7.9 min each</td><td>4 each</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:18px">The bot knows the way and skips every secret, so a person takes longer. Moths are switched off for it. It also taught me that my older ring tests had been letting go without the lift a jump gives, so those rings are easier for you than the figures on the last page said.</p>
  </div>

  <h2>Release</h2>
  <div class="col">
    <ul class="what">
      <li><b>Version numbers.</b> This is 1.1.0, shown on the title screen, and <code>build.cmd</code> raises it with every build.</li>
      <li><b>Smaller.</b> The portable exe is 277 MB instead of 298. Most of the rest is the engine and the three films, which I left at full quality.</li>
      <li><b>A trailer.</b> 67 seconds at 1080p, recorded from the game, in <code>release/Spindledeep-trailer.mp4</code>. It shows places, the chase and the opening premise, and nothing of the plot after that.</li>
      <li><b>Not signed.</b> Windows will still warn people. Signing needs a certificate bought in your name; once you have one, <code>build.cmd</code> says which two settings to fill in and the build will sign itself.</li>
    </ul>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/shaders.js</code> <code>props3d.js</code></b><span>The drawn look of the collectibles.</span></div>
      <div><b><code>app/src/deep.js</code> <code>stage.js</code></b><span>The chase: what follows the thread, the heaving dark.</span></div>
      <div><b><code>app/src/rig.js</code> <code>level.js</code></b><span>The cloth strips, the machine, the hidden rooms.</span></div>
      <div><b><code>scripts/audio_rooms.py</code></b><span>The new sounds.</span></div>
      <div><b><code>scripts/checks/play.mjs</code></b><span>The bot. <code>npm run play</code></span></div>
      <div><b><code>scripts/trailer/</code></b><span>Recording and cutting the trailer.</span></div>
    </div>
  </div>
'''
print(page('drawn', 'Spindledeep · Drawn', body, PREV))
