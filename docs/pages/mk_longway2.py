"""Changes page: the Dry Falls' seat and water, the Underway's sights, the Stores rebuilt, seats with words, the Loom shortcut closed,
the called drawn by hand, and the bitten ending's order, seat and depth (`longway2/`)."""
import os
from PIL import Image
from mkpage import page, hero, reveal

HERE = os.path.dirname(os.path.abspath(__file__))
SP = os.environ['SP']; sh = os.path.join(SP, 'sh')
IMG = os.path.join(HERE, 'longway2', 'img'); os.makedirs(IMG, exist_ok=True)

def jpg(src, name, crop=None, w=1200):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    im = im.resize((w, round(w * im.height / im.width)), Image.LANCZOS)
    im.save(os.path.join(IMG, name), quality=86)

jpg(os.path.join(sh, 'basin_before', 'basin_sit.png'), 'basin_before.jpg'); jpg(os.path.join(sh, 'basin', 'basin_sit.png'), 'basin_after.jpg')
for v in ['underway_boat', 'underway_shrine', 'underway_crack', 'underway_bones', 'seeps']:
    jpg(os.path.join(sh, 'under_before', v + '.png'), v + '_before.jpg'); jpg(os.path.join(sh, 'new2', v + '.png'), v + '_after.jpg')
jpg(os.path.join(sh, 'new3', 'drip2.png'), 'drip.jpg', (300, 0, 1500, 675))
for v in ['stores_crates', 'stores_ring', 'stores_bales', 'stores_hole', 'stores_seat']:
    jpg(os.path.join(sh, 'new2', v + '.png'), v + '.jpg')
jpg(os.path.join(SP, 'mapB2.png'), 'map_stores.jpg')
jpg(os.path.join(sh, 'sitA.png'), 'knees_before.jpg'); jpg(os.path.join(sh, 'sitN.png'), 'knees_after.jpg')
for v in ['called_back', 'called_front']:
    jpg(os.path.join(sh, 'called_before', v + '.png'), v + '_before.jpg'); jpg(os.path.join(sh, 'called_after', v + '.png'), v + '_after.jpg')
for v in ['ask1', 'ask3']:
    jpg(os.path.join(sh, 'ask_before', v + '.png'), v + '_before.jpg'); jpg(os.path.join(sh, 'ask_after', v + '.png'), v + '_after.jpg')

PREV = ' &middot; <a href="https://claude.ai/artifact/SrvQP1ij65rUBgeNK4R38z">the long way</a>'
SEAL = '''  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--fell); font-style: italic;
      text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
  </style>'''

def fig(name, cap):
    return f'    <figure style="margin:22px 0"><img src="img/{name}" alt="{cap}" style="width:100%;display:block"><figcaption>{cap}</figcaption></figure>\n'

body = SEAL + hero('the long way, again', 'Water and Words', 'The falls still drip', 'and every seat has something to say') + '''
  <div class="col summary">
    <p>A second pass over the two new stretches and the end of the game. The Dry Falls' seat now shows the whole cave and has its words, water drips and the walls sweat. The Underway has things to come upon. The Stores are less than half as long, with things in the way. Every seat has a line. The Loom can't be skipped by hanging on the thread, the figures on its floor are drawn by hand, and the bitten ending plays in the order you asked for. She bends her knees when she sits.</p>
  </div>

  <h2>The Dry Falls</h2>
  <p class="ask">The seat in the dry falls should have some text shown. And the view should show the whole magestic room. Also add some dripping droplets from the stalactites and some veins from high humidity. And you can remove the second seat in the bottom of the falls.</p>
  <div class="col">
    <p>Sitting at the seat on the lowest basin, after the camera has opened out:</p>
''' + reveal('basin', 'basin_before.jpg', 'basin_after.jpg', 'Before: the usual small step back', 'After: the whole cave of basins, roof to floor') + '''
    <ul class="what">
      <li><b>The whole room.</b> A seat can now carry its own view. This one opens out over about two seconds to the entire cave, 44 m tall and 78 m wide, and closes again when she gets up.</li>
      <li><b>Its words.</b> It shows a line the first time she sits there (sealed below, with the others).</li>
      <li><b>Water.</b> A drop swells on the tip of each stone tooth, lets go, falls, splashes on a wet patch with rings spreading over it, and makes a small plink nearby. There are nine over the basins and four in the Underway. They are harmless.</li>
      <li><b>Wet seams.</b> About eighty dark wet streaks run down the walls and roof, each with a glint of light sliding down it.</li>
      <li><b>One seat.</b> The Cistern's seat is gone; the room stays.</li>
    </ul>
''' + fig('drip.jpg', 'A drop falling from one of the stone teeth') + reveal('seeps', 'seeps_before.jpg', 'seeps_after.jpg', 'Before: dry rock', 'After: wet seams down the wall, catching the light') + '''
  </div>

  <h2>The Underway</h2>
  <p class="ask">The long corridor after the falls should have more details and points of interest. Nothin interactable but something interesting, right now ther e is nothing.</p>
  <div class="col">
    <p>Going west from the Cistern, in order:</p>
''' + reveal('crack', 'underway_crack_before.jpg', 'underway_crack_after.jpg', 'Before: bare tunnel', 'After: a crack of grey light in the roof, a mooring post under it, water dripping') + reveal('boat', 'underway_boat_before.jpg', 'underway_boat_after.jpg', 'Before: bare tunnel', 'After: a ferry left high and dry, its lamp still on its post') + reveal('bones', 'underway_bones_before.jpg', 'underway_bones_after.jpg', 'Before: bare roof', 'After: a skeleton the length of a boat set into the roof') + reveal('shrine', 'underway_shrine_before.jpg', 'underway_shrine_after.jpg', 'Before: bare floor', 'After: a ledge with candles and stones on it, a tooth of stone dripping') + '''
    <ul class="what">
      <li><b>None of it can be touched.</b> Besides these there are teeth of stone hanging from the roof, rubble where it came in, and wide places. The bones are cut into the rock like the other buried things, so they only show in her light.</li>
    </ul>
  </div>

  <h2>The Stores, shorter</h2>
  <p class="ask">The storage is also waaay too long and boring, I just walk in zig zag. Add some more obstacles and make sure that each pillow has some world story shown.</p>
  <div class="col">
    <p>Five galleries became two, and the walk is less than half as long. The bot now crosses it in 37 s instead of 59 s, for about 140 m of walking instead of 330. The hall is 76 m long instead of 86.</p>
''' + fig('map_stores.jpg', 'The Stores in plan: in from the heddle corridor top left; along the top past the crates to the gap (the bin under it), off the end, back along the second gallery over the bales and crates, down the hole, west out of the floor. The pocket on the left is the Drying Loft') + '''
    <ul class="what">
      <li><b>Crates</b> on the top gallery to hop.</li>
      <li><b>A gap with a ring over it,</b> the same reach as the Bell Gallery's. Miss it and you land in a bin below with a rope back up, so there is no way round it and nothing is lost.</li>
      <li><b>A wall of bales</b> on the second gallery, four metres high, with a rope up its face and a seat on top.</li>
      <li><b>A hole in the floor of the gallery</b> to drop through to the way out. Jump over it instead to reach the Drying Loft.</li>
      <li>Both rope climbs and the ring were played by the bot: through the gap, and out of the bin after a miss.</li>
    </ul>
''' + fig('stores_crates.jpg', 'Crates on the top gallery') + fig('stores_ring.jpg', 'The gap, its ring and the bin') + fig('stores_bales.jpg', 'The wall of bales and its rope') + fig('stores_seat.jpg', 'The seat on top of the bales') + fig('stores_hole.jpg', 'The hole to the floor; the Loft is past it') + '''
  </div>

  <h2>Every seat has its words</h2>
  <p class="ask">make sure that each pillow has some world story shown. Also remove the second pillow from the ink room.</p>
  <div class="col">
    <ul class="what">
      <li><b>Nine seats, nine lines.</b> The Mere's second seat is gone and its line moved to the Dry Falls' basin, which is at the same depth. The Drying Loft and the new seat on the bales have new lines, written to sit between the Long Room's and the lower room's on the story map. Each shows once, the first time she sits there, and waits for her voice if she is speaking.</li>
      <li><b>Saves</b> now remember which seats have spoken by where the seat is, so taking seats out can't move one seat's memory onto another.</li>
    </ul>
    <details class="seal">
      <summary>The three new or moved lines<span>Written text at the seats. Story.</span></summary>
      <div class="inner">
        <ul class="what">
          <li><b>The lowest basin, the Dry Falls</b> (moved from the Mere): Pins stuck in the seat in a row, the way she kept them on her sleeve. Eleven. One for each doll that got this far.</li>
          <li><b>The Drying Loft:</b> The skeins on the poles have all been unwound from the bottom, as if something underneath found the loose ends and pulled. One is left whole, knotted tight, and hung where nothing could reach it.</li>
          <li><b>On the bales, the Stores:</b> Someone slept up here on the bales, with a thread tied from her wrist to the post, so she would wake if she was carried off in the night. The thread has been cut, neatly, close to the wrist.</li>
        </ul>
      </div>
    </details>
  </div>

  <h2>Knees</h2>
  <p class="ask">Also when the doll is sitting anywhere make it slightly bend the knees.</p>
  <div class="col">
''' + reveal('knees', 'knees_before.jpg', 'knees_after.jpg', 'Before: straight legs out', 'After: knees bent a little, feet hanging') + '''
    <p>This applies wherever she sits: on a seat, on the ground when left alone, and in the ending. A seat also says how high it is now, and she sits on top of it, with her feet hanging as far as her legs reach.</p>
  </div>

  <h2>No shortcut in the Loom</h2>
  <p class="ask">I have also found a way to cheat the loom: if I hang on the thread while falling into it I can climb on like the middle of the way up already. please fix it.</p>
  <div class="col">
    <p>From the ledge where you come into the Loom down to the cloth, until you have tied the pole on the cloth, holding the thread does nothing and reeling in does nothing. If you were already hanging on it, you let go. Tested by running off the ledge holding the thread and reeling up:</p>
    <div class="tablebox"><table class="windows">
      <thead><tr><th>Run off the ledge, holding and reeling</th><th>Before</th><th>Now</th></tr></thead>
      <tbody>
        <tr><td>Straight off</td><td>hangs at &minus;467, 73 m above the cloth</td><td>lands on the cloth</td></tr>
        <tr><td>Swinging back and forth</td><td>hangs at &minus;467</td><td>lands on the cloth</td></tr>
      </tbody>
    </table></div>
    <p style="margin-top:14px">On the cloth the thread behaves as before. The rings further up the Loom are only reached after the cloth, so they are unaffected.</p>
  </div>

  <h2>The floor of the Loom</h2>
  <p class="ask">And I don't like the pictures of women in the bottom of the loom. Please either make them by hand or come up with something better there, I don't even understand what they mean.</p>
  <div class="col">
    <p>The photographs are gone, and the figures are drawn by hand in the game's own line. Each one is the nightclothes someone wore, standing upright with nobody inside: a long nightgown, a nightshirt over trousers, a gown with a shawl, or a coat thrown over. There is no head and no hands. The sleeves hang empty and the hems sway. When one turns toward her, the collar gapes open, long and black. They still turn, follow her and shake when the dark wakes, as before.</p>
''' + reveal('calledb', 'called_back_before.jpg', 'called_back_after.jpg', 'Before: photographs of people from behind', 'After: drawn, empty nightclothes from behind') + reveal('calledf', 'called_front_before.jpg', 'called_front_after.jpg', 'Before: photographs turned round', 'After: turned round, the collars gaping') + '''
    <details class="seal">
      <summary>What they are<span>Your question, answered. Story.</span></summary>
      <div class="inner"><p>Yes: they are the called, everyone it called down by name over the years, standing where they came to on the floor of the Loom. Drawn as only their nightclothes, it reads as people taken from their beds, with nothing of them left inside.</p></div>
    </details>
  </div>

  <h2>The bitten ending</h2>
  <p class="ask">For the thread biting ending: first show the main cutscene, then texts on black screen and then the last cutscene. Only then the titles go. And after the monster tries to climb out and the doll is walking to the candle - make it sit on something, right now it sits on nothing. And the monster's head and neck should be behind the doll, not over it.</p>
  <div class="col">
    <ul class="what">
      <li><b>In order.</b> Its film, then the cards on black, then the last film, then the titles, then back to the title screen. Holding to skip the cards goes straight to the last film; skipping the titles goes to the title screen.</li>
      <li><b>Something to sit on.</b> Her knitting basket now stands by the candle, shut, with a needle out from under the lid. The doll walks to it and sits on top, knees bent and feet hanging.</li>
      <li><b>Behind her.</b> For this scene the doll, the candle and what is around them are drawn over the thing, so its neck and head pass behind her.</li>
    </ul>
''' + reveal('ask1', 'ask1_before.jpg', 'ask1_after.jpg', 'Before: sitting on nothing', 'After: sitting on her basket') + reveal('ask3', 'ask3_before.jpg', 'ask3_after.jpg', 'Before: the neck over her', 'After: the neck behind her') + '''
  </div>

  <h2>Checked</h2>
  <div class="col">
    <ul class="what">
      <li><b>The whole game by bot,</b> plain (seeds 1 and 2) and frayed: it reaches the choice every time. The Stores take it 37 s.</li>
      <li><b>Route checks</b> (lip, gal, reach, shelfrun, fuzz, hands, rooms, quiet): all pass.</li>
      <li><b>The Loom shortcut,</b> run off the ledge before and after (table above). The rope out of the bin and the rope up the bales were climbed in a test.</li>
      <li><b>The bitten ending</b> was played through to its film, in the hidden test window.</li>
    </ul>
  </div>
  <div class="col"><div class="files">
    <div><b>app/src/level.js</b><span>the Stores rebuilt; the Underway's crack, teeth, ledge, rubble; drips; seats and their lines; the basket</span></div>
    <div><b>app/src/drawfalls.js</b><span>new: drips and wet seams</span></div>
    <div><b>app/src/drawend.js</b><span>the called drawn by hand; the basket</span></div>
    <div><b>app/src/kindle.js, draw.js, main.js</b><span>seat views and heights, knees, saves by place; the bitten ending's order</span></div>
    <div><b>app/src/world.js</b><span>the Loom: the thread does not catch on the way down</span></div>
    <div><b>app/src/shaders.js, renderer.js, ending.js</b><span>the doll in front of the thing in the last scene</span></div>
    <div><b>app/src/props.js, buried.js, drawrooms.js</b><span>the boat, shrine, mooring; the bones in the roof; the Stores' furniture</span></div>
  </div></div>
'''
print(page('longway2', 'Spindledeep · Water and Words', body, PREV))
