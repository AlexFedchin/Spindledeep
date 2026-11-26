import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal


def build(d):
    body = hero('the long neck', 'The Whole Neck', 'the head turns', 'and the neck goes with it')
    body += '''
  <div class="col summary">
    <p>The neck is back to how it was before the last change, with one difference: when the head turns, the whole neck bends round to carry it there, so it comes into the head along the head's own line and the seam stays closed.</p>
  </div>
  <p class="ask">I actually liked the old version of the neck much better, please bring it back. [&hellip;] instead of just the head turning the whole neck should move to make the new position of the head easy</p>

  <h2>Where the gap came from</h2>
  <div class="col">
    <p>The neck is a chain of joints laid along a curve from the chest to the head. In the old version the curve's last handle was set by the moment (where it reaches from), not by which way the head looked, so the neck could arrive at the head from the side while the head looked elsewhere. The last ring of the neck then met the head at a slant and the seam opened dark on one side. The last change twisted that ring round at the seam, which closed the gap but bent the neck sharply just under the head.</p>
  </div>

  <h2>Now</h2>
  <div class="col">
''' + reveal('come', 'come_b.jpg', 'come_a.jpg', 'Before (the old neck): it arrives straight from the dark, the head turned on its end', 'After: the neck dips and curves up into the head from under the jaw') + '''
    <p class="reveal-cap">Over the doll. Before is the old version you liked</p>
''' + reveal('near', 'near_b.jpg', 'near_a.jpg', 'Before: the neck comes in from the left at a slant', 'After: it curves round into the back of the head') + '''
    <ul class="what">
      <li><b>The old neck is back</b>: no ring is twisted at the seam any more; every joint lies along its curve as before.</li>
      <li><b>The curve comes to the head along the head's own line.</b> Its last handle is swung round behind the head (60% of the way), so when the head looks somewhere new, the neck bends over its whole length to bring it there, and its end ring meets the head square.</li>
      <li><b>Kept gentle.</b> At full strength the neck sagged across the doll in the asking and threw a loop above her in the tied ending; the handle is short (no more than about a quarter of the neck's length), so it only reshapes the part near the head.</li>
      <li>Everywhere the long neck is used: the asking at the candle, the head coming down in the tied ending, the climbs.</li>
    </ul>
    <figure class="still"><img src="img/tie_a.jpg" alt="The tied ending: the neck rising from her shoulders straight into the head"><figcaption>The tied ending, after</figcaption></figure>
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The neck</b><span><code>app/src/figure.js</code> (<code>headTo</code>)</span></div>
  </div></div>
'''
    style = '''<style>
    figure.still { margin: 26px 0; } figure.still img { width: 100%; display: block; border: 1px solid var(--rule); }
    figure.still figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--paper-dim); margin-top: 8px; }
    .reveal-cap { margin-top: 10px; }
  </style>
'''
    return page('neck', 'The Whole Neck', style + body, d.get('extra', ''))


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
