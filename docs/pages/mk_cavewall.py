import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal


def build(d):
    body = hero('after the titles', 'Rock in the Dark', 'the walls go out', 'and turn to broken stone')
    body += f'''
  <div class="col summary">
    <p>The film after the bitten ending&rsquo;s titles is darker now. The wall behind the doll used to read as one smooth draped sheet; now it is broken rock, in beds and blocks, with fallen stones at its foot, and only a little light reaches it, so you can barely make it out. The light from the well no longer looks like a spotlight: it fades out softly round the doll.</p>
  </div>

  <h2>The cave</h2>
  <p class="ask">Make the 26-second cutscene darker and the wall behind the doll more interesting, it is too smooth now, it should be rocks in the cave. The walls should be much darker, basically they should be barely seeable.</p>
  <p class="ask">It should not be such an obvious spotlight from top, make it softer and edges more blurred</p>
  <div class="screen"><video controls playsinline preload="metadata" poster="img/a300.jpg"><source src="vid/names_720.mp4" type="video/mp4"></video>
    <p class="reveal-cap">The whole film, {d['len']} seconds, with sound</p></div>
  <div class="col">
''' + reveal('r300', 'b300.jpg', 'a300.jpg', 'Before: the back wall lit evenly, a smooth folded sheet', 'After: the back wall is broken rock, mostly black') + '''
    <p class="reveal-cap">Halfway through: the thing on the left wall, the doll in the light</p>
''' + reveal('r450', 'b450.jpg', 'a450.jpg', 'Before: the whole dome visible', 'After: only the edges of ledges catch the light') + '''
    <p class="reveal-cap">Near the end, when the camera has gone back and the light is already less</p>
    <ul class="what">
      <li><b>Beds of rock.</b> The wall is built up of layers that tilt and pinch out. Each one juts a little over the one below and breaks off at its lip, and upright joints split the layers into blocks. Cracked faces and fine grit go over that.</li>
      <li><b>Fallen blocks</b> lie at the foot of the wall, away from where the thing crawls.</li>
      <li><b>Much less light on the walls.</b> The rock itself is darker, and the light that used to wash the walls is down to about a quarter. What&rsquo;s left comes from above and grazes down the rock: the tops of the ledges catch it and everything under them stays black. In the engraving, rock that gets no light gets no lines, so most of the cave is simply dark.</li>
      <li><b>The thing is only just there.</b> A faint light goes with it, so you can make out its shape on the rock but not much more.</li>
      <li><b>No spotlight.</b> The light that comes down the well falls off gradually from the doll outward, from a source as wide as the opening, so there&rsquo;s no bright disc with a hard rim on the floor any more. The light that picks out the doll from the front is spread the same way.</li>
      <li><b>The light from the well</b> is now a soft round shaft. Before, it filled a box with hard sides, which showed once the walls behind it went dark.</li>
      <li><b>The crawl on broken rock.</b> On rock this rough a hold can be out of reach, so now the body leans toward a hand that has to stretch. Along its route the rock is half as broken (a way worn by its hands), and its body rides 2 cm lower.</li>
    </ul>
    <div class="tablebox"><table class="windows"><tr><th>Checked</th><th>Before</th><th>After</th></tr>
'''
    for row in d['rows']:
        body += f'      <tr><td>{row[0]}</td><td class="n">{row[1]}</td><td class="n">{row[2]}</td></tr>\n'
    body += '''    </table></div>
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The film</b><span><code>app/assets/cine/names.mp4</code></span></div>
    <div><b>The cave, light and crawl</b><span><code>scripts/cine/shots_end.py</code> (<code>N1</code>, <code>Crawler.set</code>)</span></div>
  </div></div>
'''
    style = '''<style>
    .screen { max-width: 1040px; margin: 34px auto 18px; }
    .screen video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .reveal-cap { margin-top: 10px; }
  </style>
'''
    return page('cavewall', 'Rock in the Dark: after the titles', style + body, d.get('extra', ''))


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
