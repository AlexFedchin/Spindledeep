"""Changes page: no hard cuts anywhere: the passage veil between screens, pause, respawn, hidden rooms, overlay text (`passages/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/AzfFSJ6SAUkTvQczMzuRap">the cave breathes</a>'
        ' &middot; <a href="https://claude.ai/artifact/3D4qdQVi67pjES3hUbNQeu">out into the storm</a>')

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero(
    'passages', 'No Hard Cuts', 'Every screen goes through the dark', 'and comes back out of it') + '''
  <div class="col summary">
    <p>I went through every point where the game changes screen or jumps, and found twelve. All twelve now ease. Changes of screen go out to black, with a short loading line and a running red thread while anything loads. Moments inside the game (dying, pausing, finding a room, a hint changing) fade, slow or crumble instead of popping.</p>
  </div>

  <h2>Every seam, before and after</h2>
  <p class="ask">Add smooth transitions and loading screens between all the screens and moments of the game. There should be not a single hard stitch which would pop into eyes. It should all be smooth and well-polished.</p>
  <div class="col">
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Moment</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>Title &rarr; Continue</td><td>the world swapped under the fading title; the camera jumped from the title view to your peg and the zoom drifted after it</td><td>out to black with sound; <i>back down to the Throat&hellip;</i> (your area) with the thread running; the camera, zoom and light are already in place when it fades back in</td></tr>
          <tr><td>Title &rarr; Begin &rarr; prologue</td><td>the film faded in over the title menu</td><td>out to black; <i>the snow is coming&hellip;</i> while the film loads; the black lifts once the film is actually playing</td></tr>
          <tr><td>Skipping a film</td><td>the picture faded, but its sound played on, then stopped dead</td><td>the film's sound runs down over 0.7&nbsp;s as the picture goes to black</td></tr>
          <tr><td>Ending &rarr; epilogue film &rarr; credits</td><td>the film faded in over the game in under a second; between film and credits the world showed through for a moment</td><td>a slow 2.4&nbsp;s fade to black into the film; the credits are already there under the film's last black frame</td></tr>
          <tr><td>Pause and resume</td><td>the world froze mid-frame; the sound cut dead</td><td>time runs down to a stop in about 0.2&nbsp;s and picks up again the same way; the sound breathes out before the audio stops, and back in</td></tr>
          <tr><td>Return to the cottage</td><td>hard cut to the title</td><td>through black with <i>back up to the cottage&hellip;</i></td></tr>
          <tr><td>After the second ending &rarr; title</td><td>hard cut</td><td>a long fade through black</td></tr>
          <tr><td>Leave</td><td>the window just closed</td><td>picture and sound fade to black, then it closes</td></tr>
          <tr><td>Death &rarr; respawn</td><td>dimmed to 85&nbsp;%, then popped back at full brightness at the peg, with the camera swooping over</td><td>goes fully to black; she is back at the peg, camera and light already set, and the picture fades up over a second</td></tr>
          <tr><td>Finding a hidden room</td><td>the rock vanished in one frame</td><td>it crumbles away from where she stands over about 1.5&nbsp;s, with a low rumble and dust</td></tr>
          <tr><td>Hints, prompts, notes, area names changing</td><td>new text replaced the old while it was on screen</td><td>the old text fades out, swaps, and fades back in</td></tr>
          <tr><td>Fullscreen on/off</td><td>the layout jumped as the window resized</td><td>a short blink through black hides the resize</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>Continue</h2>
  <div class="col">
''' + reveal('cont', 'cont_before.jpg', 'cont_after.jpg', 'Before: half a second after Continue, the title gone and the game already in place', 'After: half a second after Continue, black with the line "back down to the Throat…" and a red thread running under it') + '''
    <p>Half a second after choosing Continue. The line names the area your save is in. It holds for at least 1.6&nbsp;s so it can be read, then the game fades in with its sound. The same passage, with its own line, is used for Begin and for returning to the cottage.</p>
    <figure class="solo" style="max-width:680px"><img src="img/begin_strip.jpg" alt="Three frames: the title fading to black, the loading line on black, the prologue film playing"><figcaption>Begin: the title goes dark &middot; the loading line &middot; the film</figcaption></figure>
  </div>

  <h2>Death</h2>
  <div class="col">
''' + reveal('die', 'die_before.jpg', 'die_after.jpg', 'Before: just after respawning, the scene already at full brightness', 'After: just after respawning, the screen still dark and coming up') + '''
    <figure class="solo" style="max-width:680px"><img src="img/die_strip.jpg" alt="Two rows of four frames through a death and respawn; the top row dims and snaps back, the bottom row goes to black and fades up"><figcaption>Top: before &middot; bottom: now (1.0, 1.75, 2.1, 2.6&nbsp;s after dying)</figcaption></figure>
    <p>Before, the screen only dimmed, so you saw her vanish and the camera swing over to the peg. Now the screen is black by the time she respawns. The camera, zoom and light jump to the peg while it's dark, and the picture fades up with her already standing there.</p>
  </div>

  <h2>A hidden room opens</h2>
  <div class="col">
''' + reveal('sec', 'sec_before.jpg', 'sec_after.jpg', 'Before: half a second after entering the Cellar, the room fully open', 'After: half a second after entering, the rock still crumbling away from its left side') + '''
    <figure class="solo" style="max-width:680px"><img src="img/sec_strip.jpg" alt="Two rows of four frames entering the Cellar; the top row opens at once, the bottom row shows the rock crumbling away over a second and a half"><figcaption>Top: before &middot; bottom: now (0.1, 0.5, 0.9, 2.4&nbsp;s after entering)</figcaption></figure>
    <p>The game draws a found room by swapping its walls from "rock" to "open". Now it blends between the two over 1.5&nbsp;s. The blend starts where she is and spreads outward, with a little noise so the edge breaks up like falling earth. A low rumble and a puff of dust go with it, and the room's name fades in over the area name instead of replacing it.</p>
  </div>

  <h2>How it was checked</h2>
  <div class="col">
    <p>Everything ran in the hidden test window through the real menus. Begin, skip, pause, resume, Return to the cottage and Leave were clicked as a player would. The tie ending was played through the epilogue film to the credits. At each step the test logged whether the screen was black, the caption, the game's sound level and whether the audio was running:</p>
    <ul class="what">
      <li><b>Begin:</b> black with the caption at 0.6&nbsp;s, game sound faded out, film playing and the black lifted by 3.3&nbsp;s.</li>
      <li><b>Skip:</b> the film's volume went 1.0 &rarr; 0.31 &rarr; 0 as the picture went black, then straight into the walk out of the cottage.</li>
      <li><b>Pause:</b> sound 0.90 &rarr; 0.02 in 0.1&nbsp;s, audio stopped at 0.3&nbsp;s; back to 0.89 within 0.4&nbsp;s of resuming.</li>
      <li><b>Epilogue &rarr; credits:</b> credits fully up while the film was still fading out; the world never showed.</li>
      <li><b>Leave:</b> faded to black, then the window closed.</li>
    </ul>
    <p style="margin-top:14px">One fix came out of the checks: the loading line first appeared over the title while the title was still fading out. It now comes up only once the screen is black. Fullscreen wasn't tried in the test window, because it would make the hidden window visible on your screen; it uses the same passage.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/main.js</code></b><span><code>passage()</code>, <code>veil()</code> and <code>setText()</code>; every screen change goes through them. Also: the pause time-ease, the respawn fade with <code>camSnap</code>, <code>startReveal</code>/<code>revealStep</code>, the film skip and the credits under the epilogue.</span></div>
      <div><b><code>app/src/terrain.js</code></b><span><code>revealPair()</code>: the room's walls before and after, for the blend.</span></div>
      <div><b><code>app/index.html</code> &middot; <code>app/style.css</code></b><span>The <code>#veil</code> with its caption and running thread; <code>.swapping</code> for text changes.</span></div>
    </div>
  </div>
'''
print(page('passages', 'Spindledeep · No Hard Cuts', body, PREV))
