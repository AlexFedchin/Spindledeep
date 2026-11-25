"""Changes page: the keepsakes and the skein as real models (`things/`). What some of them show is plot: those are sealed."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/BC9NNRnJbHDSzwdFnwnxjF">buried</a>'
        ' &middot; <a href="https://claude.ai/artifact/6bqJt6HgPBpE5bcSrLgANS">bitten</a>')
CSS = '''  <style>
    .wide { max-width: 900px; margin: 0 auto; }
    details.seal { max-width: 900px; margin: 34px auto; border: 1px solid var(--rule); padding: 18px 22px; }
    details.seal summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
    details.seal summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    details.seal[open] summary { margin-bottom: 22px; }
  </style>'''


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a) + '  </div>\n'


body = CSS + hero('what she finds', 'Things', 'Nine drawings', 'made into nine things') + '''
  <p class="ask">now please make also all the collectibles much more detailed. They are shown full screen and look too cartoonish</p>
  <div class="col summary">
    <p>All eight keepsakes and the skein are now real three-dimensional models, lit and engraved live like the rest of the game, shown almost twice as large and turning slowly. You can turn them yourself with the mouse. They are the same models where they lie in the caves.</p>
  </div>
''' + rv('skein', 'Before: the skein as a flat disc with a few ellipses', 'Now: a wound ball of two-ply yarn with loose fibres') + rv('thimble', 'Before: the thimble as a flat outline', 'Now: a dented silver thimble with rows of pits and an engraved band') + rv('button', 'Before: the coat button', 'Now: a worn metal button with a laurel, torn thread still in it') + rv('seeds', 'Before: the packet of seeds', 'Now: a printed paper packet, folded, stained, swollen by the seeds in it') + '''
  <details class="seal">
    <summary>Sealed: the other five. What is on them is part of the story</summary>
''' + rv('spool', 'Before: the spool', 'Now: the spool') + rv('eye', 'Before: the button eye', 'Now: the button eye') + rv('mitten', 'Before: the mitten', 'Now: the mitten') + rv('pattern', 'Before: the pattern', 'Now: the pattern') + rv('shoe', 'Before: the shoe', 'Now: the shoe') + '''  </details>

  <h2>What changed</h2>
  <div class="col">
    <ul class="what">
      <li><b>Modelled, not drawn.</b> Yarn is real strands: every stitch of the knitting is a loop of it, and the ball is wound turn by turn. Both have fibres that have worked loose, and ends that fray.</li>
      <li><b>Worn.</b> Wood, metal, horn, leather and paper are each made of their own grain, scratches, dirt in the hollows and bare edges where hands have been.</li>
      <li><b>Printed and written.</b> Everything lettered is on the thing itself, so you can read it there.</li>
      <li><b>Lit for looking at.</b> A warm light from the upper left, a cold edge from behind, and polished things reflect a dark room. Everything behind them goes quiet while one is held up, and the bright haze that washed them out is gone.</li>
      <li><b>Finer lines.</b> Close up, the engraving is finer and lies over a continuous tone, so it still looks printed but the detail stays.</li>
      <li><b>Yours to turn.</b> Drag with the mouse to turn one and see its back. A click without dragging, or any key, puts it away as before.</li>
      <li><b>No waiting.</b> A model is loaded when you come within 45 metres of the thing. The old drawing stands in if one is not there yet.</li>
    </ul>
  </div>

  <h2>Checked</h2>
  <div class="col">
    <p>All nine were shown one after another in the running game, with no errors. With one held up the game ran at 58 frames a second. Turning one by dragging kept it up, and a click then put it away. Three keepsakes and a skein were looked at where they lie.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/props3d.js</code></b><span>Loading, how each one is held, its lights, turning it.</span></div>
      <div><b><code>app/src/shaders.js</code></b><span>The prop pass: plies, polish, and how it is engraved.</span></div>
      <div><b><code>scripts/props3d/build.py</code></b><span>The models and their materials, built and baked in Blender.</span></div>
      <div><b><code>scripts/props3d/maps.py</code></b><span>Everything printed, written, scratched or stamped on them.</span></div>
      <div><b><code>app/assets/props/</code></b><span>The nine models.</span></div>
    </div>
  </div>
'''
print(page('things', 'Spindledeep · Things', body, PREV))
