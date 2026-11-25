import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal


def build(d):
    body = hero('after the titles', 'Every Name', 'a light from far up', 'and something on the walls')
    body += f'''
  <div class="col summary">
    <p>The bitten ending now has a film after its titles instead of a black screen. The tied ending joins its film without a jump: the climb stops at the mouth of the cave, and the film begins there, hands first. Plucking is on <kbd>;</kbd>.</p>
  </div>

  <h2>After the titles</h2>
  <p class="ask">make a cutscene for the ending where i cut the thread after the titles. [&hellip;] the doll sitting on the floor of the cave under some pale top-down light, monster crawling behind it over the walls and trying names. The camera should be slowly zooming out.</p>
  <div class="screen"><video controls playsinline preload="metadata" poster="img/names.jpg"><source src="vid/names_720.mp4" type="video/mp4"></video>
    <p class="reveal-cap">The whole film, {d['len']} seconds, with sound. In the game each name is also subtitled.</p></div>
  <div class="col">
''' + reveal('coda', 'coda_before.jpg', 'coda_after.jpg', 'Before: a black screen with a stray piece of thread and a name', 'After: the doll in the light from the well, the thing on the wall behind it') + f'''
    <ul class="what">
      <li><b>One shot, one move.</b> The camera goes back from the doll in a straight line at one speed, on one lens, until the whole cave is in view.</li>
      <li><b>It crawls.</b> On hands and feet over the rock, up the wall and onto the roof. A hand or foot that is down stays down until it lifts, and moves on in diagonal pairs.</li>
      <li><b>It stops to ask.</b> At every name it stands still, its head comes round to the doll, and the jaw moves with the recording. Then it waits, and goes on.</li>
      <li><b>One name makes the doll look up.</b> It is the fifth, and it isn&rsquo;t hers.</li>
      <li><b>The light.</b> It falls down the well and lies on the floor round the doll, with the grey thread and the petals. At the end the thing reaches the mouth of the well, and the light goes.</li>
      <li><b>The sound.</b> Palms and toes on rock are placed by the crawl itself, the names carry round the cave, water drips. Far above, the title&rsquo;s tune runs at half its speed.</li>
      <li><b>A fault gone with the old screen:</b> a piece of red thread was left floating on the black.</li>
    </ul>
    <div class="tablebox"><table class="windows"><tr><th>Checked</th><th>Result</th></tr>
      <tr><td>Camera speed, fastest against slowest frame</td><td class="n">{d['lin']}</td></tr>
      <tr><td>Sound in the film against the movement</td><td class="n">{d['sync']}</td></tr>
      <tr><td>Flicker (back-and-forth change per pixel, 0 to 255)</td><td class="n">{d['flick']}</td></tr>
      <tr><td>Hand or foot sliding while it is down</td><td class="n">{d['slide']}</td></tr></table></div>
    <p class="reveal-cap">The first version pulled back faster and from closer, and flickered at 12.8</p>
  </div>

  <h2>Out of the cave</h2>
  <p class="ask">the monster running out of cave animation should end when it reaches the exit of the cave. After that the cutscene should start with hands popping out of the cave</p>
  <div class="col">
''' + reveal('tie', 'tie_before.jpg', 'tie_after.jpg', 'Before: it crawled all the way to the cottage, and then the film showed the pit again', 'After: the last stretch is the climb to the lip') + '''
    <ul class="what">
      <li><b>The last stretch is the way out.</b> It comes over the first ledge and up the wall of the pit. As it gets to the top everything goes black and silent.</li>
      <li><b>The film begins on the other side</b> of that same lip, with the hands. The shot of the cottage that used to open it comes second.</li>
      <li><b>That second shot is new.</b> It had no one in it, so nothing said how the thing got from the pit to the house.</li>
    </ul>
  </div>
  <details class="seal">
    <summary>Open the tied ending&rsquo;s film</summary>
    <div class="screen"><video controls playsinline preload="metadata" poster="img/o1_after.jpg"><source src="vid/outro_720.mp4" type="video/mp4"></video>
      <p class="reveal-cap">The whole film in its new order, with sound</p></div>
    <div class="col">
''' + reveal('o1', 'o1_before.jpg', 'o1_after.jpg', 'Before: the line and the cottage, no one there', 'After: it walks home along the thread and stands at her window') + '''
      <p>It walks along the thread the way she used to come home, with its arms hanging and its eyes on the window. Seventeen steps, each foot planted, each step heard on the frame it lands. When it stops at the window, the light goes out.</p>
    </div>
  </details>

  <h2>The key</h2>
  <p class="ask">make thr default key for the pluck to be ;</p>
  <div class="col">
    <p>Plucking is <kbd>;</kbd> by default, and the prompts and the choice at the end show it. <kbd>F</kbd>, <kbd>J</kbd> and <kbd>C</kbd> still work. A key you have chosen yourself in the options stays as you set it.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The film</b><span><code>app/assets/cine/names.mp4</code></span></div>
    <div><b>The shot</b><span><code>scripts/cine/shots_end.py</code> (<code>N1</code>, <code>Crawler</code>)</span></div>
    <div><b>After the titles</b><span><code>app/src/main.js</code> (<code>coda</code>)</span></div>
    <div><b>The climb</b><span><code>app/src/ending.js</code> (<code>startClimb</code>, <code>climb</code>)</span></div>
    <div><b>The key</b><span><code>app/src/input.js</code></span></div>
  </div></div>
'''
    style = '''<style>
    .screen { max-width: 1040px; margin: 34px auto 18px; }
    .screen video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .reveal-cap { margin-top: 10px; }
    kbd { font-family: var(--mono); font-size: .82em; border: 1px solid var(--rule); padding: 1px 7px; }
    details.seal { max-width: 900px; margin: 34px auto; border: 1px solid var(--rule); padding: 18px 22px; }
    details.seal summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
    details.seal summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    details.seal[open] summary { margin-bottom: 22px; }
  </style>
'''
    return page('names', 'Every Name: after the titles', style + body, d.get('extra', ''))


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
