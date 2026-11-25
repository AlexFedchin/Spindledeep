"""Changes page: nothing in the rock by accident, bones and shells in it on purpose (`buried/`). Open."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/6bqJt6HgPBpE5bcSrLgANS">bitten</a>'
        ' &middot; <a href="https://claude.ai/artifact/NZ8LqQVJhCyzqS1shjTGD7">listen</a>')
CSS = '''  <style>
    .wide { max-width: 900px; margin: 0 auto; }
  </style>'''


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


body = CSS + hero('in the ground', 'Buried', 'Nothing in the rock by accident', 'and a few things on purpose') + '''
  <p class="ask">make sure there are no unintended objects inside the ground, there are some mushrooms in the middle of the ground in some place. You can put some intentional object there though - like bones for example. But make sure they look like they belong there and do not pop into eyes much</p>

  <h2>The mushrooms</h2>
  <div class="col">
    <p>They were the mushroom pots of the Seed Hollow, the hidden room under the Root Gardens. Things are set down by looking for the floor below them, but in the hidden rooms that search began inside the roof and climbed out of it upwards. Ten things ended up 5 to 14 metres above the rooms they belong to, nine of them inside solid rock: the pots, a row of garden markers, a lantern, a bucket, candles, a stool, letters, boots and two piles of baskets. All ten are now in their rooms and stay hidden until the room is found.</p>
  </div>
''' + rv('mush', 'Before: three mushrooms glowing in solid rock beside the Root Gardens', 'Now: only rock') + rv('seed', 'Before: the Seed Hollow was empty', 'Now: its pots and its row of markers are in it') + '''
  <h2>Everything else in the rock</h2>
  <div class="col">
    <p>I then drew every layer of the game over the whole world and listed each spot where something shows inside rock. The list went from 192 entries, one for each two-metre square, to 11. Those 11 are meant: the ends of the roots and yarn the upper shelves hang by, a corner of a basket on a slope, and the glow of two candles on the floor under them.</p>
    <ul class="what">
      <li><b>Warp threads in the Loom.</b> The hundreds of threads behind everything ran straight through ledges and up to 13 metres into the walls. They now stop at the rock.</li>
      <li><b>Heddles and needles.</b> The heddles of the Treadles were drawn over the ceiling when pulled up, and the Loom&rsquo;s needles showed through the wall. Both now come out of the rock.</li>
      <li><b>The woodshed.</b> Its back reached half a metre down through the snow as a dark slab.</li>
      <li><b>Blots in the ledges.</b> In the middle of every ledge the engraved lines clotted into small white squiggles that looked like things in the ground. The lines now run level there.</li>
      <li><b>Dark shapes in front.</b> Mounds, hanging roots and stalactites in the foreground drifted over the rock as you moved, or hung from nothing. The mounds are gone, the grass stays on the floor, and the rest shows only where it hangs from a roof.</li>
      <li><b>Two smaller ones.</b> The veil over the shaft in the Bell Gallery ends at the shaft&rsquo;s walls, and the old faded thread in the Treadles lies on the ground instead of cutting through it.</li>
    </ul>
  </div>
''' + rv('cellar', 'Before: a dark slab under the woodshed, squiggles in the rock over the cellar', 'Now: clean ground') + rv('tread', 'Before: the heddle frames drawn over the ceiling', 'Now: they come out of it') + rv('ledge', 'Before: squiggles along the middle of the ledge', 'Now: lines, and two old bones') + '''
  <h2>What lies there on purpose</h2>
  <div class="col">
    <p>About a hundred things are set into the rock over the whole descent, never two within eight metres of each other. They are cut into the rock&rsquo;s own lines, so they take the same light, fade with depth the same way, and are not there at all in the dark. You will pass most of them without noticing.</p>
    <ul class="what">
      <li><b>They follow the depth.</b> Shells and roots near the top, then small beasts and broken pots, fish under the Mere, and worse further down.</li>
      <li><b>They are always well inside the rock.</b> Every part of each one is checked against the cave, and none is near a hidden room, on an upper shelf, or under the top of the Loom.</li>
    </ul>
  </div>
''' + rv('bone', 'Before: the Bell Gallery', 'Now: a long bone in the ledge') + rv('shell', 'Before: an island in the Ink Mere', 'Now: a coiled shell in it') + rv('head', 'Before: the floor of the Loom', 'Now: a skull in it') + '''
  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/buried.js</code></b><span>The bones and shells: what, where, and how they are drawn.</span></div>
      <div><b><code>app/src/shaders.js</code></b><span>Cutting them into the rock; level lines in the middle of ledges.</span></div>
      <div><b><code>app/src/props.js</code></b><span>The floor search, and the hidden rooms&rsquo; things.</span></div>
      <div><b><code>app/src/drawdeep.js</code></b><span>Warp threads, heddles, needles, the old thread.</span></div>
      <div><b><code>app/src/draw.js</code></b><span>The foreground, the veil, the woodshed.</span></div>
      <div><b><code>scripts/checks/inside.js</code></b><span>The check that lists everything drawn inside rock.</span></div>
    </div>
  </div>
'''
print(page('buried', 'Spindledeep · Buried', body, PREV))
