"""Changes page: the deep below the Ink Mere, the Loom's horror and the second ending (`deep/`). Structure only in the
open; the plot is sealed (the user asked not to be spoiled)."""
from mkpage import page, hero
SEAL = '''
  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--italic, 'IM Fell English', serif);
      font-style: italic; text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''

PREV = (' &middot; <a href="https://claude.ai/artifact/WvqLyGh8TYMumLFxf7kzcc">four small mends</a>'
        ' &middot; <a href="https://claude.ai/artifact/7RuHZ4rS7YwJKUTTZ9ZKDt">her, at last</a>')


def fig(img, alt, cap):
    return f'''    <figure style="margin:18px 0 6px"><img src="img/{img}" alt="{alt}" style="width:100%;display:block;border:1px solid var(--rule)">
      <figcaption>{cap}</figcaption></figure>
'''


body = SEAL + hero('the deep', 'Much Deeper', 'Four new places below the Mere', 'and the Loom is no longer just a room') + '''
  <div class="col summary">
    <p>The world is now twice as deep: 604&nbsp;m from the cottage to the bottom instead of 304. What used to be the bottom is now the first of four new areas. Each brings its own way of moving or its own danger. Together the route below the Ink Mere is now longer than everything above it, and harder. The Loom is now a real final act with something in it, and there are now two endings.</p>
    <p>This page describes places and mechanics only. Who is down there and what happens is sealed at the bottom.</p>
  </div>

  <h2>What was added</h2>
  <p class="ask">The game is beatable in like 5 minutes. There should be something terrifying in the Loom. You have to make the game much longer and the ending should be better.</p>
  <div class="col">
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Area</th><th>What you do there</th></tr></thead>
        <tbody>
          <tr><td>The Hall of Chairs</td><td>The old bottom chamber, rebuilt. Rows of rocking chairs in the dark, one candle, and a hole in the floor: lower yourself down on your thread.</td></tr>
          <tr><td>The Hush</td><td>Black caverns and an 80&nbsp;m gallery. Things reach out of the walls for anything that stays quiet. Pluck the thread to drive them back; lit bells keep them still; don't linger.</td></tr>
          <tr><td>The Treadles</td><td>Rings that swing on chains over a barbed pit (wait for the ring to come to you). A rope to climb. A corridor of heddle frames that slam to a beat (listen for the creak). Then a long drop, in two stages, down a well.</td></tr>
          <tr><td>The Loom</td><td>A cavern 120&nbsp;m tall strung with warp threads. Down to its floor, then a climb against the clock: ropes, a long swinging chain, needles that stab across the warp, and something coming up behind you.</td></tr>
        </tbody>
      </table>
    </div>
''' + fig('hall.jpg', 'The Hall of Chairs: rows of rocking chairs, one lit candle', 'The Hall of Chairs') + \
    fig('hush.jpg', 'The Hush: a long knitted arm reaching down from the ceiling toward the doll', 'The Hush, standing still a moment too long') + \
    fig('tread.jpg', 'The Treadles: pillars over a barbed pit, rings on chains', 'The Treadles: three swinging rings over the barbs') + \
    fig('hed.jpg', 'The heddle corridor: frames hanging from the roof, one slammed down', 'The heddle corridor') + \
    fig('loom.jpg', 'The Loom: a ledge, a warp thread, the long chain', 'The Loom, partway up') + '''
    <ul class="what" style="margin-top:16px">
      <li><b>New moves:</b> hold grip beside a rope or warp thread to climb it, and jump to leap off sideways.</li>
      <li><b>New dangers:</b> the hands in the walls, the heddles, the needles, swinging rings, and a final climb with something rising behind you.</li>
      <li><b>17 new poles</b> (30 in all), so a death never sends you far back. The well down to the Loom has a ledge halfway, because one fall was longer than your yarn.</li>
      <li><b>Two new hidden rooms</b> with keepsakes (8 in all).</li>
      <li><b>Five new voice lines</b>, recorded with the same old-woman voice pipeline. One of them uses a different voice on purpose.</li>
      <li><b>New sound:</b> the Loom's machinery beating somewhere below in the Treadles, and a new cue in the Loom built from the game's own sounds. Neither has trumpets.</li>
      <li><b>Three new paintings</b> behind the engraving: walls of draped cloth, the underside of a great loom, a cavern of hanging threads.</li>
    </ul>
  </div>

  <h2>Played through by a bot</h2>
  <div class="col">
    <p>Every new stretch was played with the game's real physics by a scripted player that ties at a pole, then walks, jumps, swings, climbs, plucks and waits. It found real problems that are now fixed:</p>
    <ul class="what">
      <li>A hidden room you could only reach by jumping a 4.4&nbsp;m hole (the shaft mouth is now narrow).</li>
      <li>A barbed trench at the very limit of a running jump (now 2.2&nbsp;m).</li>
      <li>A swing whose landing ledge sat higher than the ring, so no swing could reach it.</li>
      <li>A rope out of reach from its ledge.</li>
      <li>The rising danger catching you the instant it woke, because the floor isn't flat to the centimetre.</li>
      <li>The fall into the Loom being longer than the yarn, which would have left you dangling mid-shaft.</li>
    </ul>
    <div class="tablebox" style="margin-top:16px">
      <table class="windows">
        <thead><tr><th>Stretch</th><th>Result</th></tr></thead>
        <tbody>
          <tr><td>Hall pole &rarr; down the hole &rarr; first pole of the Hush</td><td>passes, 9&nbsp;s</td></tr>
          <tr><td>The Hush, plucking as you go, to the Treadles</td><td>passes, about 32&nbsp;s; standing still for 3&nbsp;s without plucking kills you, plucking keeps you alive</td></tr>
          <tr><td>Hidden room in the Hush, there and back</td><td>passes</td></tr>
          <tr><td>The three swinging rings</td><td>each gap has a window of good release times at most points of the swing; at a bad moment you wait a second for the ring to come back</td></tr>
          <tr><td>Rope, heddle corridor (timed), the well</td><td>passes; running the heddles blindly gets you crushed</td></tr>
          <tr><td>The Loom: floor to the top with the danger rising</td><td>passes in about 55&nbsp;s with time to spare; also from the mid-climb pole</td></tr>
          <tr><td>The second ending, start to credits</td><td>runs through, with its own cards, credits and a scene after them</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px">How long it takes now: a perfect scripted run through the new part alone takes about 2.5 minutes of pure movement. The new route is longer and harder than the old game was end to end, and the hands, heddles and the final climb are made to kill you a few times. I'd expect a first playthrough of the whole game to take well over twice as long as before. If you finish it and still find it short, I can go further.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/level.js</code></b><span>The new areas, poles, rings, ropes, hands, heddles, needles, the rising danger, the new knots and hidden rooms.</span></div>
      <div><b><code>app/src/deep.js</code> &middot; <code>drawdeep.js</code></b><span>The rules and the drawing for all of the deep's machinery.</span></div>
      <div><b><code>app/src/player.js</code></b><span>Climbing ropes and warp threads.</span></div>
      <div><b><code>app/src/main.js</code></b><span>The second ending, its cards and the scene after the credits; sounds for the new things; saves stay compatible.</span></div>
      <div><b><code>docs/STORY.md</code></b><span>The plot (spoilers).</span></div>
    </div>
  </div>

  <div class="col"><details class="seal">
    <summary>The plot &middot; spoilers<span>Open only when you want to know. Everything below gives the deep and both endings away.</span></summary>
    <div class="inner">
      <p><b>The Hall of Chairs.</b> Forty-one rocking chairs, each with the same grey shawl over it; one candle still burns, by hers, and she isn't in it. Her knot: there are forty-one chairs and every one of them is hers. Every knitter was the same woman, because each doll is made in the image of the one who made it.</p>
      <p><b>The Hush.</b> The walls are packed cloth, and the hands in them are knitted. The knot here is the wrong voice again, and it tells you <i>not</i> to pluck. It is trying to get you killed.</p>
      <p><b>The Treadles.</b> A faded red thread lies along the ledge: a doll's thread from seventy winters ago. The knot in it isn't her voice but an older woman's, the knitter before her, saying word for word what the knitter will say to you at the end. The ending is a script, and it has been said forty-one times.</p>
      <p><b>The Loom.</b> Its floor is woven cloth, and the cloth is faces, all the same face: hers. The chorus (many of her voices at once) tells you to sit down and be still. When you step off the pole on the cloth, the cloth heaves up into one vast figure with her face, the Weaver, and rises after you while you climb the warp. At the top she sits woven in to the waist, her candle beside her, with the grey thread in her hands. She is the model you chose, rendered into the game's engraving.</p>
      <p><b>Two endings.</b> <i>Tie the threads</i> is the old ending, the cycle going on. <i>Bite through her thread</i> is new. "Oh... oh, little one. It's so quiet." The Weaver stops and sinks, and the faces close their eyes. Her candle goes out. Then something below takes hold of the red thread, the last line to the surface, and the doll bites through its own thread too. The light goes out. Cards: that winter no name was called up the well; in the spring the snow on the Brink began to melt. After the credits: the doll sitting in her place in the dark, and the sound of needles.</p>
    </div>
  </details></div>
'''
if __name__ == '__main__':
    print(page('deep', 'Spindledeep · Much Deeper', body, PREV))
