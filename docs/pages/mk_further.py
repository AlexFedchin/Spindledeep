"""Changes page: the eight improvements (`further/`). Structure only; nothing of the plot."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/1Nw7Pg3WD3HzuWupWjqqWn">things</a>'
        ' &middot; <a href="https://claude.ai/artifact/BC9NNRnJbHDSzwdFnwnxjF">buried</a>')
CSS = '''  <style>
    .wide { max-width: 900px; margin: 0 auto; }
    .fig { margin: 8px 0 26px; }
    .fig img { display: block; width: 100%; height: auto; border: 1px solid var(--rule); }
    .fig figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); margin-top: 10px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


def fig(n, cap, alt):
    return f'  <div class="wide"><figure class="fig"><img src="img/{n}.jpg" alt="{alt}"><figcaption>{cap}</figcaption></figure></div>\n'


body = CSS + hero('all eight points', 'Further', 'Six new rooms', 'and more to do with one thread') + '''
  <p class="ask">please implement all the points that you mentioned</p>
  <div class="col summary">
    <p>All eight are in. The way down is longer by six rooms, two under each of the Hall, the Hush and the Treadles, and each is built on something new the thread can do. Around them: a fairer Mere, moths and hands that react, a shelf for the keepsakes, options, a second way to play, and a fresh build.</p>
  </div>

  <h2>New rooms, new uses for the thread</h2>
  <div class="col">
    <ul class="what">
      <li><b>Sinking rings.</b> Hang from one and it goes down while a door goes up. Wait too long and you are too low to swing out; go too soon and the door is not open. It stays up for six and a half seconds.</li>
      <li><b>Handles.</b> Catch one in the air, land still holding, and wind in: it slides toward you and pulls out a bridge or lifts a door. It stays where you leave it.</li>
      <li><b>Spindles.</b> They turn while your thread runs past them, and their door opens only when both turn. There are two ways round each slab of rock, so you choose which way to run the thread.</li>
      <li><b>The bobbin.</b> A wheel as tall as three dolls rolls up and down its lane. Lie low in a gutter and let it pass: it fouls on your own thread and stands for four seconds.</li>
    </ul>
  </div>
''' + fig('door', 'under the Hall &middot; a sinking ring over the pit, and the door it lifts', 'A pit with a ring over it and a tall door of needles on the left') + fig('pew', 'under the Hall &middot; the bridge being wound out', 'A bridge sliding out over a trench of pins') + fig('slab', 'round the Hush &middot; a spindle on the first slab', 'A spindle on a slab of rock, the doll below it') + fig('bob', 'below the Treadles &middot; the bobbin, fouled on the thread', 'A huge bobbin wound round with the red thread, the doll in a gutter') + fig('low', 'below the Treadles &middot; a handle and its door', 'A handle on a rail on the left, a door of needles on the right') + '''
  <div class="col">
    <p>The second room of each pair brings the area&rsquo;s own danger back with rings or handles added: hands over beds of pins in the Hush, heddles and swinging rings below the Treadles. There are thirteen new poles and three new skeins. Nothing that existed has moved except the hole in the Hall, which now has a mat across it and a way round beneath, the tunnel between the Hush&rsquo;s first two caves and the well below the Treadles, which now lead through the new rooms. A bot crossed every room with the real thread, each with several or many timings:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Room</th><th>Timings that work</th></tr></thead>
        <tbody>
          <tr><td>The sinking ring and its door</td><td>11 of 49</td></tr>
          <tr><td>The handle and the bridge</td><td>9 of 9</td></tr>
          <tr><td>The two slabs, the right way / the wrong way</td><td>5 of 9 / 0 of 3, as meant</td></tr>
          <tr><td>The two rings over the pins</td><td>6 of 24 and 14 of 59</td></tr>
          <tr><td>The bobbin, from gutter to gutter / just running</td><td>16 of 16 / 0 of 24, as meant</td></tr>
          <tr><td>The lower room: swinging ring, handle, last ring</td><td>13 of 59, 9 of 9, 7 of 49</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:18px">The bots let go on the first forward swing after a set time, so a person who looks has more chances than that. The older rings of the Gallery and the Mere score between 6 and 42 in the same kind of test.</p>
  </div>

  <h2>The Mere&rsquo;s last jump</h2>
  <div class="col">
    <p>It was as bad as your deaths suggested. From the last island only 6 of 20 places to jump from worked, and only with the jump button held down. The shore now comes out 1.4 metres further and is level, and a lamp burns on it so you can see where to land. Now 19 of 20 work with a held jump.</p>
  </div>
''' + rv('shore', 'Before: the far shore of the Mere, unlit', 'Now: nearer, level, and with a lamp on it') + '''
  <h2>Moths and hands</h2>
  <div class="col">
    <ul class="what">
      <li><b>Hands feel you move.</b> Stop dead when the earth crumbles and the hand strikes where you were heading, misses, and gives up for a while. It does not help when one comes up right under you. A bot that only ever stopped crossed the first of the new Hush rooms untouched; in the long gallery stopping alone was not enough, and it needed to pluck as well.</li>
      <li><b>Moths try the thread first.</b> They circle it for a moment before they settle, and cannot settle on a thread that is being shaken. They come to what moves, and forget you if you stand still.</li>
      <li><b>They get used to plucking.</b> Each fright soon after another keeps them away for less.</li>
    </ul>
  </div>

  <h2>Her shelf</h2>
  <div class="col">
    <p>Every keepsake you have ever found stands on a shelf by her door, and <i>Her shelf</i> is on the title screen. Open it at either place to turn each one over and read it again; the ones in your present save are already there. Finding all eight in one run gives the doll her second eye, and she sees half as far again in the dark.</p>
  </div>
''' + fig('shelf', 'by her door', 'The cottage wall with two small shelves of keepsakes') + '''
  <h2>Options</h2>
  <div class="col">
    <ul class="what">
      <li><b>Picture.</b> Brightness, screen shake, and detail, which lowers itself if the game runs slowly.</li>
      <li><b>Sound.</b> Separate levels for voices, music and sounds.</li>
      <li><b>Words and time.</b> Four sizes for words on screen, and a clock you can show.</li>
      <li><b>Controls.</b> Every key can be changed. The arrows, Enter and Esc always work in menus, so you cannot lock yourself out.</li>
    </ul>
  </div>
''' + rv('title', 'Before: the title menu', 'Now: with her shelf and options') + '''
  <h2>Coming back</h2>
  <div class="col">
    <ul class="what">
      <li><b>Frayed.</b> After an ending, <i>Begin anew</i> offers a harder descent: a fifth less yarn, moths that bite through faster, and rings that swing where they used to hang still (one gap is too wide for that, and its ring stays put). All twelve ring gaps were tested with it.</li>
      <li><b>Your time.</b> Runs are timed. The credits show the time and how many dolls you lost, and your best time stands in the menu.</li>
    </ul>
  </div>

  <h2>Release</h2>
  <div class="col">
    <p>The exe files in <code>release</code> are rebuilt with everything so far. The screens were checked at wide, 4:3 and nearly square window shapes and fit in all of them. At half detail the game still held 58 frames a second, but I only have a fast graphics card here, so a slow one is untested. A save from before the new rooms was loaded and its thread was laid again clear of the rock.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/rig.js</code></b><span>Sinking rings, handles, spindles, the bobbin.</span></div>
      <div><b><code>app/src/level.js</code></b><span>The six rooms.</span></div>
      <div><b><code>app/src/drawrig.js</code> <code>drawrooms.js</code></b><span>How they look.</span></div>
      <div><b><code>app/src/options.js</code> <code>input.js</code></b><span>Options and keys.</span></div>
      <div><b><code>app/src/deep.js</code> <code>world.js</code></b><span>Hands and moths, the Frayed run.</span></div>
      <div><b><code>scripts/checks/rooms.mjs</code></b><span>The bots that cross the rooms.</span></div>
    </div>
  </div>
'''
print(page('further', 'Spindledeep · Further', body, PREV))
