"""Changes page: missing keepsakes, rooms that open in time, and the sound of the place (`listen/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/R161kCaf6HSZvYkHuLaabt">kept out of the rock</a>'
        ' &middot; <a href="https://claude.ai/artifact/J1avXLArMvcKdXb2hRBTGz">what is down there</a>')

SEAL = '''  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--fell); font-style: italic;
      text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''

body = SEAL + hero('items, rooms, sound', 'Listen', 'The rock opens first', 'and the cave answers') + '''
  <div class="col summary">
    <p>Two of the eight keepsakes had no picture at all, and the others were washed out to a white dot. Hidden rooms opened only once you were standing in them. Both are fixed. The sound now comes from where you are: the size of the cave, the rock in the way, what you walk on, and a lot of small things that happen on their own.</p>
  </div>

  <h2>The missing things</h2>
  <p class="ask">also some of the collectible items are either completely missing or just not rendered. Please fix it.</p>
  <div class="col">
    <ul class="what">
      <li><b>Two keepsakes were never drawn.</b> The ones in the two deepest hidden rooms, in the Hush and the Treadles, had words but no picture: you found a glow, and nothing rose into the light. Both are drawn now, in the room and held up.</li>
      <li><b>All eight were hard to see.</b> Each lay inside a glow stronger than itself, so in the room it was a white dot. The glow is a faint halo now, a small light falls on the thing, and it is a third larger.</li>
      <li><b>A pale ring no longer crosses the picture.</b> The flash of picking a keepsake up froze in front of it when time stopped.</li>
      <li><b>The rest were checked.</b> All five skeins and eleven knots are in open air. I picked up all eight keepsakes in the hidden test window and looked at each one held up.</li>
    </ul>
  </div>
  <div class="col"><details class="seal">
    <summary>The two new pictures<span>Two things you may not have found yet.</span></summary>
    <div class="inner">
''' + reveal('quiet', 'quiet_before.jpg', 'quiet_after.jpg', 'Before: an empty glow', 'After: the thing itself') + reveal('shoe', 'shoe_before.jpg', 'shoe_after.jpg', 'Before: an empty glow', 'After: the thing itself') + '''    </div>
  </details></div>

  <h2>The rooms open first</h2>
  <p class="ask">And the hidden rooms should reveal earlier when I enter, otherwise item is shown before the room is revealed</p>
  <div class="col">
    <p>The same two spots inside hidden rooms, before and after.</p>
''' + reveal('cache', 'cache_before.jpg', 'cache_after.jpg', 'Before: the doll is inside solid rock and the keepsake floats in it', 'After: the crack and the room are open and the doll stands in them') + reveal('basket', 'basket_before.jpg', 'basket_after.jpg', 'Before: the same in another room', 'After: the room is open') + '''
    <ul class="what">
      <li><b>Earlier.</b> The rock starts to crumble while you are still in the mouth of the crack, two to three metres before the part that was hidden. It runs ahead of you and takes 0.9 seconds instead of 1.5.</li>
      <li><b>In order.</b> The keepsake, its light and everything else in the room appear only when the rock over that spot has gone, and nothing can be picked up through rock.</li>
      <li><b>Still secret.</b> How close you are is measured by walking distance through the crack, so passing on the other side of a wall opens nothing, and no pole or stretch of the grey thread is close enough to open one. The room's name still comes when you step in.</li>
    </ul>
    <div class="tablebox" style="margin-top:16px">
      <table class="windows">
        <thead><tr><th>Running in with the real controls</th><th>Rock starts to open</th><th>You reach the hidden part</th><th>Item can be seen</th><th>You reach the item</th></tr></thead>
        <tbody>
ROWS
        </tbody>
      </table>
    </div>
  </div>

  <h2>The sound of the place</h2>
  <p class="ask">And add more detailed sound design to the game, it should be more responsive to the surrounding and more variable.</p>
  <div class="col">
    <p>Until now every place rang the same. Ten times a second the game now feels out the cave around you, and nearly everything you hear passes through that. This is one footstep, recorded from the game in each place, until it had faded by 45&nbsp;dB:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Where</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>The Brink, outdoors</td><td class="n">1.4 s</td><td class="n">0.4 s</td></tr>
          <tr><td>A crawl in the rock</td><td class="n">1.5 s</td><td class="n">0.2 s</td></tr>
          <tr><td>The Hush, between earth walls</td><td class="n">1.5 s</td><td class="n">1.2 s</td></tr>
          <tr><td>The Throat, on a ledge</td><td class="n">1.4 s</td><td class="n">1.5 s</td></tr>
          <tr><td>The Bell Gallery</td><td class="n">1.5 s</td><td class="n">3.6 s</td></tr>
          <tr><td>The Ink Mere</td><td class="n">1.5 s</td><td class="n">3.7 s</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>Space.</b> Four reverbs blend by the size of the cave, with separate echoes off the wall to your left and to your right. In a crawl the background and the music turn dull, and you hear yourself brush the rock.</li>
      <li><b>Distance and rock.</b> Far sounds lose their brightness. A sound behind rock comes through muffled, mostly as the cave's answer to it.</li>
      <li><b>Your feet.</b> Snow, stone, gravel, earth, dry leaves, wet rock, boards and wool, three to six recordings each, never the same one twice running. They follow your speed, and get lighter as your yarn runs out. Landings match the ground, and a hard one shakes dust off a low roof.</li>
      <li><b>Edges.</b> Near a drop you may kick a pebble over. It knocks on the way down and lands, or plops into the ink, after as long as the fall takes.</li>
      <li><b>A pluck is answered.</b> It comes back off the far walls, later the farther they are, and bells you have not woken yet stir quietly where they stand.</li>
      <li><b>Things with a place.</b> Flames, the ink lapping at its nearest edge, closed veils, lit bells, iron rings on chains: you can walk past them and hear which side they are on.</li>
      <li><b>Things on their own.</b> Each of the nine areas has its own: falling pebbles, insects and roots, far chains, bubbles and groaning under the ink, rocking chairs, trickling earth. They come at random times, distances and pitches, most of them from a real surface near you.</li>
      <li><b>It notices you.</b> Insects and chairs go quiet when you run, land hard or pluck, and come back. Stand still and the place comes closer.</li>
      <li><b>Air.</b> Wind past you in a long fall or a fast swing. Looking over a deep drop, the pit's moan rises.</li>
      <li><b>Beds and music.</b> The background layers drift on slow tides. In the caves a piece of music plays once, then the place is left alone for about a minute before it comes back.</li>
      <li><b>Death and found things.</b> When you die, or hold something up, the world goes under as if through water.</li>
    </ul>
    <p>Kept to what you asked before: none of the new sounds is thread or rope, and nothing is brass. One recording of leaning trees was dropped because it ticked like a tightening rope. The finale's own silences are untouched.</p>
  </div>

  <h2>How it was checked</h2>
  <div class="col">
    <p>The NSOUNDS new sound files were levelled, and samples of them looked at as spectrograms. The game's own output was recorded in ten places, old build against new: the overall loudness is about the same, and a pluck is slightly softer. Three minutes were simulated in every area to see how often things happen. Both endings were started again in the hidden test window without errors. I can't hear any of it, so tell me what is too loud, too frequent or wrong.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/sound.js</code></b><span>New. The cave's acoustics, the ground, the edges, and <code>LIFE</code>: what happens on its own, one line each.</span></div>
      <div><b><code>app/src/audio.js</code></b><span>Four reverbs, echoes, muffling, variants, placed loops.</span></div>
      <div><b><code>app/src/world.js</code> &middot; <code>main.js</code></b><span><code>mouthZone</code> and the rooms opening.</span></div>
      <div><b><code>app/src/props.js</code></b><span>The keepsakes.</span></div>
      <div><b><code>scripts/audio/build_audio.py</code></b><span>The <code>detail_*</code> recipes; every recording used is CC0 and listed in the credits.</span></div>
    </div>
  </div>
'''
NAMES = ['The Cellar', "The Diggers' Cache", 'The Seed Hollow', "The Ringer's Cell", 'The Sill', 'The Last Basket', 'The Quiet Room', 'The Shoe']
RUNS = __import__('json').load(open(__file__.replace('mk_listen.py', 'listen/runs.json'), encoding='utf-8'))
rows = '\n'.join(f'          <tr><td>{n}</td>' + ''.join(f'<td class="n">{v:.2f} s</td>' for v in r) + '</tr>' for n, r in zip(NAMES, RUNS['runs']))
body = body.replace('ROWS', rows).replace('NSOUNDS', str(RUNS['sounds']))
print(page('listen', 'Spindledeep · Listen', body, PREV))
