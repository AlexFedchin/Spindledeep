"""Changes page: she sits on the seats, not over them (`seated/`)."""
from mkpage import page, hero, reveal
PREV = (' &middot; <a href="https://claude.ai/artifact/SrvQP1ij65rUBgeNK4R38z">the long way</a>'
        ' &middot; <a href="https://claude.ai/artifact/6pYm2N71bBfZK35RBgkrzz">water and words</a>')
body = hero('a fix', 'Seated', 'Her weight on the cloth', 'not a hand above it') + '''
  <div class="col summary">
    <p>When she sat down she hung a little above the seat. She now rests on it: on the folded cloth of every seat, and on the lid of her basket at the end of the bitten ending.</p>
  </div>

  <h2>On the seat, not over it</h2>
  <p class="ask">the doll is now floating on over the pillows when sitting. Make it actualy touch them.</p>
  <div class="col">
''' + reveal('seat', 'seat_before.jpg', 'seat_after.jpg', 'Before: her body above the cloth', 'After: sitting down into the cloth') + reveal('basket', 'basket_before.jpg', 'basket_after.jpg', 'Before: above the basket lid', 'After: on the lid') + '''
    <ul class="what">
      <li><b>Why she floated.</b> She was lifted by a fixed height per seat, worked out from where I thought her body's underside was. Measured on screen, she ended up about 15 cm over the stones. The basket only looked closer because it is taller.</li>
      <li><b>Now it is measured.</b> Each seat records where her weight rests, in world height: the middle of the folded cloth's top face on the stones, and the middle of the lid on the basket. When she sits, she is lifted exactly so the underside of her body meets that point. This holds at any size she has frayed to and on any ground.</li>
      <li><b>Why the middle of the face.</b> The seats are drawn with their top surface showing, from the back rim forward. Something resting on them sits in the middle of that surface, not on the rim, or it reads as floating even when touching.</li>
      <li><b>Checked</b> in the game at the Orchard's seat and in the ending, by logging her screen position against the seat's and reading the pixels. The quiet-place check (sit, any key, get up, walk) still passes.</li>
    </ul>
  </div>
  <div class="col"><div class="files">
    <div><b>app/src/draw.js</b><span>lift her so her body meets the seat's resting point</span></div>
    <div><b>app/src/kindle.js, ending.js</b><span>each seat says where her weight rests (`top`)</span></div>
  </div></div>
'''
print(page('seated', 'Spindledeep · Seated', body, PREV))
