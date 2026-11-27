"""Changes page: the logs read again, dimming gone, the rising dark rebuilt, sitting animated, two new stretches of the way down,
and her voice notes waiting their turn (`longway/`)."""
import os
from PIL import Image
from mkpage import page, hero, reveal

HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.environ['SP']                                    # scratchpad with the shots
PICS = os.path.join(HERE, '..', '..', 'scripts', 'checks', '.cache', 'pics')
IMG = os.path.join(HERE, 'longway', 'img'); os.makedirs(IMG, exist_ok=True)

def jpg(src, name, crop=None, w=1200):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(IMG, name), quality=86)

sh = os.path.join(SP, 'sh')
jpg(os.path.join(sh, 'before', 'dark2.png'), 'dark_near_before.jpg'); jpg(os.path.join(sh, 'after', 'dark2.png'), 'dark_near_after.jpg')
jpg(os.path.join(sh, 'before', 'dark3.png'), 'dark_far_before.jpg'); jpg(os.path.join(sh, 'after', 'dark3.png'), 'dark_far_after.jpg')
jpg(os.path.join(sh, 'sitB.png'), 'sit_before.jpg'); jpg(os.path.join(sh, 'sitA.png'), 'sit_after.jpg')
jpg(os.path.join(sh, 'sit_after.jpg'), 'sit_frames.jpg')
for v in ['seat_mere', 'shaft', 'well']:
    jpg(os.path.join(PICS, 'a580c00-1600x900', v + '.png'), v + '_before.jpg'); jpg(os.path.join(PICS, 'now-1600x900', v + '.png'), v + '_after.jpg')
for v in ['falls_in', 'basins', 'basins_low', 'cistern', 'underway', 'stores_top', 'stores_mid', 'loft', 'stores_low', 'stores_out']:
    jpg(os.path.join(sh, 'new', v + '.png'), v + '.jpg')
jpg(os.path.join(SP, 'mapA.png'), 'map_falls.jpg'); jpg(os.path.join(SP, 'mapB.png'), 'map_stores.jpg')

PREV = (' &middot; <a href="https://claude.ai/artifact/3C5nb632w1gs7DtHhMTir6">a candle by each seat</a>'
        ' &middot; <a href="https://claude.ai/artifact/AYKzta15bUY8tubMhJjCjH">the seats in red</a>')

def fig(name, cap):
    return f'    <figure style="margin:22px 0"><img src="img/{name}" alt="{cap}" style="width:100%;display:block"><figcaption>{cap}</figcaption></figure>\n'

body = hero('a longer way down', 'The Long Way', 'More of the dark to cross', 'and less said in it') + '''
  <div class="col summary">
    <p>Your last playthrough's log, read against all the earlier ones, led to this batch. The way down is now longer: two new stretches, the Dry Falls and the Stores, add roughly five minutes, with nothing in them that can hurt you and no new words. Her voice notes no longer talk over each other. The earth that rises in the Loom has been rebuilt, sitting on a seat is a small scene of its own, and the dimming key is gone.</p>
  </div>

  <h2>The logs read again</h2>
  <p class="ask">Okay, fix the logs</p>
  <div class="col">
    <p><code>scripts/checks/logs.py</code> still looked for the old line about yarn left, which 1.2.1 no longer writes, so it counted nothing from the current build. It now reads all three formats the game has written, and it also lists where deaths cluster. This is from all of your sessions together:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Where</th><th>Deaths</th></tr></thead>
        <tbody>
          <tr><td>Ink, the first island off the Mere's east shore (x 92&ndash;96)</td><td class="n">9</td></tr>
          <tr><td>Ink, the second island (x 80&ndash;84)</td><td class="n">11</td></tr>
          <tr><td>Thorns under the Bell Gallery (x 32&ndash;36)</td><td class="n">5</td></tr>
          <tr><td>Ink, the third, sixth and west shore (x 68, 28, 20)</td><td class="n">5 each</td></tr>
          <tr><td>Thorns on the Pin Walk, past pole 37</td><td class="n">3</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>No more dimming</h2>
  <p class="ask">remove the dimming feature (I don't understand what it does, it seems to be useless)</p>
  <div class="col">
    <ul class="what">
      <li><b>Gone.</b> The key (Q, V, H, or LB on a pad) and its line in Controls are removed, along with the two hints that taught it and the breath that ran out while you held it. LB now holds the thread, like the other shoulder buttons.</li>
      <li><b>What it did.</b> Held, it turned her light down: moths lost her, the hands in the Hush felt her from less far, and what crept along the thread was slower. In your run it was pressed four times. Nothing else depended on it. The Hush is tuned for plucking, and the bots cross it without dimming.</li>
    </ul>
  </div>

  <h2>The earth that rises in the Loom</h2>
  <p class="ask">improve the rising dirt with hands in the loom, it looks kind of unpolished: I can see the beginning of the cut hands, the dirt is not detailed at all</p>
  <div class="col">
    <p>The same moment, with the earth held just under her ledge.</p>
''' + reveal('near', 'dark_near_before.jpg', 'dark_near_after.jpg', 'Before: rows of arms with their cut ends showing', 'After: the arms come out of a ridge of earth') + '''
    <p>Further out, with the earth a few metres lower:</p>
''' + reveal('far', 'dark_far_before.jpg', 'dark_far_after.jpg', 'Before: a band of arms floating over a flat black', 'After: two ridges of earth with arms rooted in them') + '''
    <ul class="what">
      <li><b>No arm ends.</b> It is drawn back to front: a dim row of arms, the ridge of earth they come out of, the near arms, then the near earth. Each arm's foot goes under the lowest point of the earth across its whole width, so no cut end can show however the ground heaves.</li>
      <li><b>Earth with a surface.</b> The crest is lumpy: a clod sits on it every 30 cm or so and the outline swells under each. There are pale stones among the clods, roots and here and there a strand of old yarn standing out of it, and broken lines of grain underneath that fade into the black.</li>
      <li><b>It moves like earth.</b> Long swells travel along it, it churns and swells harder while it gathers to heave, the clods jostle, and crumbs fall off the crest.</li>
      <li><b>It can be seen.</b> A few weak cold lights ride along the crest, so the engraving shades the soil and the arms instead of leaving a flat shape. Nothing below the crest is lit or drawn.</li>
      <li><b>Arms that reach.</b> Between the clusters stand single arms. Those near her come up further and lean toward her.</li>
    </ul>
  </div>

  <h2>Sitting on a seat</h2>
  <p class="ask">For the pillows: make a short cute sit down animation and when sitting the doll should be looking around. Then If I press any key once - the doll should have a cute little stand up animation and only after that become controllable.</p>
  <div class="col">
''' + reveal('sit', 'sit_before.jpg', 'sit_after.jpg', 'Before: she sinks into the stone', 'After: she sits up on it, legs over the edge, looking round at you') + '''
    <figure style="margin:22px 0"><img src="img/sit_frames.jpg" alt="Frames: walking up, crouch, hop, plop; sitting and looking about; one key, push off, hop, land" style="width:100%;display:block"><figcaption>Frames from one sit: crouch, hop, plop (top row); looking about (middle); one key, then push off, hop and land (last row)</figcaption></figure>
    <ul class="what">
      <li><b>Sitting down, under a second.</b> A little crouch, a hop up onto the stone, a plop with a bounce. She now sits on top of the seat rather than half inside it, and her legs dangle off its front and kick.</li>
      <li><b>Looking about.</b> While she sits she looks ahead, turns her face round toward you, looks up, looks down into her lap, and now and then back over her shoulder, on a slow loop of about sixteen seconds.</li>
      <li><b>Any key gets her up.</b> Any key or button except pause: she puts her hands down, leans, pushes off, hops and wobbles as she lands. Only then is she yours again. The key you pressed does nothing else, so Space does not also jump.</li>
    </ul>
  </div>

  <h2>A longer way down</h2>
  <p class="ask">make the map bigger without adding new mechanics or dangers [&hellip;] It should feel like a lonely descent but I am only listening to notes all the time and reading letters [&hellip;] The new parts of the map should come to around +5 minutes of gameplay.</p>
  <div class="col">
    <p>The world is twice as wide below ground now. Everything that was there is where it was; the new caves are cut into fresh rock east of the old edge, and the way down passes through them twice. Nothing in them can hurt you: no ink, thorns, hands, machines or moths, and no rings or ropes are needed. Every drop is a step down and no fall does harm. There are no new knots, letters or lines at the seats. Each stretch has a quiet room with a seat, its own backdrop painting, lamps, things left lying about and its own sound.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Stretch</th><th>Bot</th><th>You, ~1.7&times;</th></tr></thead>
        <tbody>
          <tr><td>The Dry Falls (Bell Gallery to Ink Mere)</td><td class="n">54 s</td><td class="n">~1.5 min</td></tr>
          <tr><td>The Stores (heddles to the bobbin's lane)</td><td class="n">~75 s</td><td class="n">~2.1 min</td></tr>
          <tr><td>The two quiet rooms and their seats</td><td class="n">&mdash;</td><td class="n">~1 min if you stop</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>The Dry Falls</h2>
  <div class="col">
    <p>The shaft under the veil no longer drops straight into the Mere. Its foot opens onto a dry stream bed that runs east into a tall cave of stone basins, seven of them stepping down, each with a worn rim where water once stood and stone curtains hanging far overhead. A chute at the far end drops into the Cistern, a round quiet room with a seat. From there the Underway, a long low gallery, runs about a hundred metres back west under the basins and comes out on the Ink Mere's east shore. Poles stand at the foot of the shaft, at the lowest basins, in the Cistern and halfway along the Underway.</p>
''' + fig('map_falls.jpg', 'The Dry Falls in plan (air light, rock dark): red poles, blue seats, yellow the old woman\'s grey thread. In from the shaft top left, down the basins, into the Cistern, back along the bottom to the Mere') + fig('falls_in.jpg', 'The foot of the shaft') + fig('basins.jpg', 'The upper basins') + fig('basins_low.jpg', 'The lowest basins, with a seat') + fig('cistern.jpg', 'The Cistern') + fig('underway.jpg', 'The Underway') + '''
    <p>Where it comes out, before and after:</p>
''' + reveal('mere', 'seat_mere_before.jpg', 'seat_mere_after.jpg', 'Before: the Mere\'s east shore ends in rock', 'After: the Underway opens onto it') + reveal('shaft', 'shaft_before.jpg', 'shaft_after.jpg', 'Before: the shaft runs on down into the Mere', 'After: it turns east into the Dry Falls') + '''
  </div>

  <h2>The Stores</h2>
  <div class="col">
    <p>The heddle corridor no longer ends at the well: it runs on east into a storehouse hall cut in the rock, sixty metres tall and eighty-five long, with five galleries one under another. You go east along the top, step off its end onto the next, go back west along that one, and so on down, five floors, then west out of the bottom to the well's old ledge. The well itself is filled in. Shelves of great empty bobbins stand on every gallery, timber posts hold them up, and bales of wool hang on chains between them. Off the third gallery's west end is the Drying Loft, a small quiet room with skeins hung over poles, candles and a seat.</p>
''' + fig('map_stores.jpg', 'The Stores in plan: in from the heddle corridor top left, down the five galleries, out at the bottom to the well\'s ledge; the Loft is the pocket on the left, middle') + fig('stores_top.jpg', 'The top gallery') + fig('stores_mid.jpg', 'The second gallery') + fig('loft.jpg', 'The Drying Loft') + fig('stores_low.jpg', 'The fourth gallery') + fig('stores_out.jpg', 'The floor, by the way out') + reveal('well', 'well_before.jpg', 'well_after.jpg', 'Before: the well shaft', 'After: filled in, the way is through the Stores') + '''
  </div>

  <h2>Voice notes wait their turn</h2>
  <p class="ask">also I sometimes reach next voice note before the old one finished playing. Then there are notes overlapping with them.</p>
  <div class="col">
    <ul class="what">
      <li><b>One at a time.</b> A knot you reach while she is still speaking, or while a letter is open, waits. It starts 1.8 seconds after the last one has finished, or after the letter is put away. A seat's line waits for her voice too.</li>
      <li><b>Further apart.</b> The Dry Falls lies between her knot in the Bell Gallery and the one in the Ink Mere, and the Stores between the Treadles' knot and the lower room's. One letter on the Bell Gallery's crowded east ledge (you found two there twelve seconds apart) now lies in the Cistern. Nothing new was written.</li>
    </ul>
  </div>

  <h2>Checked</h2>
  <div class="col">
    <ul class="what">
      <li><b>The whole game by bot,</b> cottage to the choice, plain (seeds 1 and 2) and frayed: it reaches the choice every time, through both new stretches, which it crosses on the first try.</li>
      <li><b>The route checks</b> (lip, gal, reach, shelfrun, fuzz, hands, rooms, quiet) pass. The quiet-place check now tests that one key gets her up and that she cannot be moved until she is up.</li>
      <li><b>Nothing drawn in rock:</b> the inside-the-rock scan now covers the wider world and the furniture, and finds only the old known spots.</li>
      <li><b>Nothing else moved:</b> all 45 old views were compared with the last build. Only the shaft, the well, the Mere's east shore and the Bell Gallery's east ledge (the letter) changed, plus the Loom's entrance view, whose camera no longer stops at the old edge. The Brink is framed exactly as before, and its ground still ends where it did.</li>
      <li><b>Loading</b> builds the wider rock in about 2.3 s instead of 1.6 s.</li>
    </ul>
  </div>
  <div class="col"><div class="files">
    <div><b>app/src/level.js</b><span>the new caves, poles, seats, places, lights, backdrops; the shaft and the well</span></div>
    <div><b>app/src/drawend.js</b><span>the rising earth</span></div>
    <div><b>app/src/draw.js, kindle.js</b><span>sitting down, looking about, getting up</span></div>
    <div><b>app/src/drawrooms.js, props.js</b><span>shelves, bales, skeins, the Cistern's buckets; things left lying about</span></div>
    <div><b>app/src/main.js</b><span>voice notes in turn; the Brink's camera</span></div>
    <div><b>app/src/life.js, buried.js, draw.js</b><span>glows, beasts, bones and hanging things for the new ground (the old keep their seeds)</span></div>
    <div><b>app/assets/art/falls.webp, stores.webp</b><span>two new backdrop paintings</span></div>
    <div><b>scripts/checks/logs.py, play.mjs, quiet.mjs, pics.py, inside.js</b><span>the log reader; the bot's new legs; new views</span></div>
  </div></div>
'''
print(page('longway', 'Spindledeep · The Long Way', body, PREV))
