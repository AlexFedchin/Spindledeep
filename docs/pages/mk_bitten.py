"""Changes page: the bitten ending's scenes and film, no growing in the dark, the first ring's lip, two upper ways (`bitten/`).
Open: the user lifted the spoiler rule for how the endings look. Clips (`bitten/vid/`, not in git) are recorded from the game."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/NZ8LqQVJhCyzqS1shjTGD7">listen</a>'
        ' &middot; <a href="https://claude.ai/artifact/8soWEEYQZJFzENtU2f5s7K">the ending</a>')
CSS = '''  <style>
    .clip { margin: 8px 0 26px; }
    .clip video { display: block; width: 100%; height: auto; border: 1px solid var(--rule); background: var(--ink-2); }
    .clip video:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
    .clip figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); margin-top: 10px; }
    .wide { max-width: 900px; margin: 0 auto; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''


def clip(n, cap, ar):
    return f'''  <div class="wide"><figure class="clip"><video id="v-{n}" controls playsinline preload="none" poster="img/p_{n}.jpg" src="vid/{n}.mp4" style="aspect-ratio: {ar}"></video><figcaption>{cap}</figcaption></figure></div>
'''


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


body = CSS + hero('the bitten ending', 'Bitten', 'She bites the thread in two', 'and then it goes looking') + '''
  <p class="ask">I don't like the way the game ends when I bite the thread, it's basically just this thing saying "What have you done?" and then black screen, that is disappointing. Add some cinematic for it as well please</p>
  <div class="col summary">
    <p>The bitten ending is now about a minute and a half of scenes: one minute played by the game, then a rendered film of 37 seconds, then the same cards as before. The clips have the game&rsquo;s sound; the subtitles are not in the recordings.</p>
  </div>

  <h2>In the game</h2>
  <div class="col">
    <ul class="what">
      <li><b>The bite.</b> Close on the doll as the red goes out of the thread. It asks what you have done, twice, and the second time her neck comes forward in three jerks.</li>
      <li><b>The red goes out.</b> The light dies up the whole thread, from the bottom to the top: the Hall of Chairs, the Bell Gallery, the Throat, and over the snow to her door. A bell it passes rings once more. When it reaches the door, the wind drops for the first time in the game.</li>
      <li><b>It tries the thread.</b> In the well above the Loom it comes up what is left, hand over hand. The thread parts above it. It hangs there with the end in its hand, turns to look at you, and falls.</li>
      <li><b>It asks.</b> The doll walks back along her dead thread to the candle and what is left of the knitter. The face comes in beside her and asks for her name, goes over her head and down the other side to ask again, and blows the candle out.</li>
    </ul>
  </div>
''' + clip('bite', 'the whole scene as the game plays it &middot; 63 seconds', '1280 / 696') + '''
  <h2>The film</h2>
  <div class="col">
    <p>Rendered like the prologue, from the same places, so it reads as that night undone. The storm ends and the snow melts off the Brink. Her window is empty, with the spinning wheel still in it and sweet peas coming up past the sill. Her grey thread lies through the grass to the pit; the camera goes over the edge and down the well. At the bottom, what is in her chair has the doll in its lap and whispers names in its ear, until it notices you.</p>
  </div>
''' + clip('film', 'the new film &middot; 37 seconds', '16 / 9') + '''
  <h2>No more growing in the dark</h2>
  <p class="ask">When I am tying a thread to it, I can see it scale up in the dark, it should either happen slower and smoother so that it is less noticable, or just not at all</p>
  <div class="col">
    <p>Not at all. She used to grow from 1.65 to 2.70 times life size in 3.3 seconds, hidden only by the dark, so on a bright screen it showed. Her body now keeps one size through the whole scene. Her head also used to jump up out of the picture in a single frame; it now rises over 4.4 seconds. I checked the frames with the brightness pushed up: nothing pops.</p>
  </div>
''' + rv('reveal', 'Before: she has grown by the time the light comes up', 'Now: the same size as when she was holding out the thread') + clip('tie', 'the moment of tying &middot; 13 seconds', '1280 / 696') + '''
  <h2>The bump at the first ring</h2>
  <p class="ask">the jump with the first ring in the map has a small bump right before it in the exact place i am trying to jump, and apparently because of this bump I am falling for a split second and cannot jump</p>
  <div class="col">
    <p>You were right. The bump threw her off the ground, and by the time she landed past it the jump was already lost, half a metre before the edge.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Running off the edge at</th><th>Last moment a jump worked, before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>The first ring (Bell Gallery)</td><td>0.6 m before the edge</td><td>0.8 m past it</td></tr>
          <tr><td>The spare ring in the Throat</td><td>0.2 m before the edge</td><td>0.5 m past it</td></tr>
          <tr><td>The other eleven rings</td><td>0.6 to 0.8 m past it</td><td>0.7 to 1.1 m past it</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:18px">
      <li><b>The two ledges are level now,</b> right up to the edge.</li>
      <li><b>Bumps anywhere no longer throw her.</b> While walking she keeps to the ground over small bumps; real edges still drop her. Before this, small bumps took her off the ground on the way to twelve of the thirteen take-offs.</li>
      <li><b>A jump pressed a little late counts for longer:</b> 0.13 s after leaving the ground instead of 0.10 s.</li>
      <li><b>The swings are unchanged.</b> All 12 ring gaps were run again: the same let-go times work, give or take one step in a few gaps, and one gap in the Mere is more forgiving.</li>
    </ul>
  </div>
''' + rv('lip', 'Before: the ground humps up right where you jump', 'Now: level to the edge') + '''
  <h2>Two rooms, two new ways</h2>
  <p class="ask">there are also 2 hidden rooms which I see but cannot reach, they are behind a hole which is larger than my jump [...] could you please add an alternative separate path to this room on top (parkour over platforms) which leads me just to this room?</p>
  <div class="col">
    <p>Your play logs showed which two: the Last Basket, past the hole in the Hall of Chairs, was the only room you never opened, and the alcove with a skein in the Root Gardens, past the drop, was the only skein you never took. A search through every run and jump the doll can make confirmed that neither could be reached on foot. The holes are as wide as they were.</p>
    <ul class="what">
      <li><b>The Root Gardens.</b> Seven shelves hung in roots lead along the roof from where you come in to the alcove. Five more lead up to them from the floor, so a fall is not the end of it.</li>
      <li><b>The Hall of Chairs.</b> Nine chair seats hung on yarn climb from among the chairs and cross over the hole to a ledge in the far wall. A chute goes down through the roof of the room. You come out by the old crawl, past a new pole, and drop down the hole to go on.</li>
      <li><b>Checked</b> with the real thread on both ways, from the nearest poles and with no extra yarn. The thread never runs short.</li>
    </ul>
  </div>
''' + rv('g1', 'Before: the alcove top left, over the drop, with no way to it', 'Now: shelves along the roof and up from the floor') + rv('hall', 'Before: the hole in the Hall of Chairs', 'Now: hanging seats up and over it') + '''
  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/ending.js</code></b><span>The bitten ending, part by part; the tied one at a constant size.</span></div>
      <div><b><code>scripts/cine/shots_cut.py</code></b><span>The five shots of the film; <code>render_cut.sh</code> renders them, <code>edit.py cut</code> cuts it.</span></div>
      <div><b><code>app/src/level.js</code></b><span>SHELVES, LEVEL (planed ledges), the chute, pole 30.</span></div>
      <div><b><code>app/src/drawshelf.js</code></b><span>What the shelves hang by.</span></div>
      <div><b><code>app/src/player.js</code></b><span>Keeping to the ground over bumps.</span></div>
    </div>
  </div>
'''
print(page('bitten', 'Spindledeep · Bitten', body, PREV))
