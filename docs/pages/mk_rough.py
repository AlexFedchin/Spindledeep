"""Changes page: rougher stone lines (`rough/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/KqKHAJhVneDr7eihafk6BM">worn</a>'
        ' &middot; <a href="https://claude.ai/artifact/5uSdDNUyBLywtGkXhW31me">the trailer</a>')
CSS = '  <style>\n    .wide { max-width: 900px; margin: 0 auto; }\n  </style>'


def rv(i, what):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', what + ', before', what + ', now') + '  </div>\n'


body = CSS + hero('the stone', 'Rough', 'A line cut by hand', 'catches on the stone') + '''
  <p class="ask">make the stone lines a bit rougher, they are too smooth and parallel now</p>

  <h2>What changed</h2>
  <div class="col">
    <ul class="what">
      <li><b>They waver.</b> Neighbouring lines crowd together and spread apart instead of running side by side, with a smaller tremble on top.</li>
      <li><b>They swell and thin.</b> The same line is thicker in one place and finer in another, and now and then one breaks off.</li>
      <li><b>Rougher where the stone is.</b> Hewn rock in the Treadles, split stone in the Throat and earth in the Gardens are the roughest, wet stone round the Mere and frozen earth on the Brink the smoothest.</li>
      <li><b>No rings.</b> The regular ripple patterns deep in the rock, which came from the lines being too even, are broken up.</li>
    </ul>
    <p>The edge of the rock, where she stands, is the same: no steps came back, and nothing in the movement changed. A first try was twice as strong and hid the cracks and columns, so this is the gentler one.</p>
  </div>
''' + rv('throat', 'Split stone in the Throat') + rv('bell_mid', 'Columns in the Bell Gallery') + rv('roots', 'Earth in the Root Gardens') + rv('hush', 'Packed soil in the Hush') + rv('lane', 'Hewn rock in the Treadles') + '''
  <div class="col">
    <div class="files">
      <div><b><code>app/src/shaders.js</code></b><span><code>roughOf</code>: how rough each kind of stone is.</span></div>
    </div>
  </div>
'''
print(page('rough', 'Spindledeep · Rough', body, PREV))
