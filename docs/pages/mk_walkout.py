"""Changes page: from the prologue into the game (storm bridge, the walk out of the cottage) and the hidden cursor (`walkout/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/9FAgaVuMKJjeRyNrvpxfRS">much deeper</a>'
        ' &middot; <a href="https://claude.ai/artifact/AzfFSJ6SAUkTvQczMzuRap">the cave breathes</a>')

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero('the threshold', 'Out Into the Storm', 'From the film', 'to the first step in the snow') + '''
  <div class="col summary">
    <p>The prologue no longer cuts straight to the doll standing in the yard. The storm keeps blowing across the cut, the game fades up on the shut cottage door, and she walks out of the house before you take control. The mouse pointer is hidden whenever no menu is open.</p>
  </div>

  <h2>A seam you can't see</h2>
  <p class="ask">Please add a smoother transition between the first cutscene and the start of the game. Right now it is way too obvious. Maybe add some overlapping snowstorm sound? And make the doll exit the house before we get control over it (not in the video but already in game).</p>
  <div class="col">
    <p>Before, the film ended on its title card fading to black and silence. Then the whole game snapped in at once: full picture, full storm, the controls hint already up, the doll already in the yard. Now the handover is spread over about seven seconds:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>When</th><th>Picture</th><th>Sound</th></tr></thead>
        <tbody>
          <tr><td>Last 4 s of the film</td><td>the title card fades to black</td><td>the storm rises underneath, heavily muffled, as if heard through log walls</td></tr>
          <tr><td>0&ndash;2.8 s</td><td>the game fades up from black, close on the shut door; the window is lit</td><td>only the muffled storm; the game's own sound is held back</td></tr>
          <tr><td>1.7 s</td><td>the door swings open onto the dark room</td><td>a long creak; the muffle opens to the full gale, then hands over to the game's own wind as it comes up</td></tr>
          <tr><td>2.4&ndash;3.2 s</td><td>she stands on the sill and looks up into the snow</td><td>wind</td></tr>
          <tr><td>3.2&ndash;3.7 s</td><td>she steps down off the sill into the snow</td><td>a footstep in the snow</td></tr>
          <tr><td>3.7&ndash;5 s</td><td>she walks out into the yard; the view starts easing back</td><td>her steps</td></tr>
          <tr><td>5 s</td><td>a gust bangs the door shut behind her; snow bursts off the frame</td><td>the bang, low and heavy</td></tr>
          <tr><td>about 7 s</td><td>the view settles at its usual distance; the controls hint appears</td><td>&mdash; she is yours</td></tr>
        </tbody>
      </table>
    </div>
''' + reveal('start', 'start_before.jpg', 'start_after.jpg', 'Before: the game cuts straight to the doll standing in the yard, the whole Brink in view', 'After: close on the cottage, the door open, the doll on the sill against the dark room') + '''
    <figure class="solo" style="max-width:680px"><img src="img/strip.jpg" alt="Four frames: the shut door fading up from black, the door open with the doll on the sill, the doll stepping down, the door banging shut as the view draws back"><figcaption>Fade up on the door &middot; on the sill &middot; stepping down &middot; the door bangs shut</figcaption></figure>
    <ul class="what">
      <li><b>The room behind her is dark.</b> Only a low firelit wash lies along the floor and the step. I tried a bright doorway first, but her pale felt vanished against it. Against the dark she reads as a small pale figure leaving the house.</li>
      <li><b>No prompts while she walks.</b> The controls hint waits until she's out, and look-up/down is off until then.</li>
      <li><b>Only after the prologue.</b> Continue drops you at your last peg as before, with sound straight on. Skipping the film still brings the storm in, just faster. Leaving for the title mid-walk restores the sound and stops the storm.</li>
    </ul>
    <p style="margin-top:14px">Checked in the hidden test window, through the real Begin button and film. The muffled storm starts under the title card while the film is still playing. The game's sound is silent until the door opens and back to full about two seconds later. The storm layer is gone after nine seconds. I can't listen, so the balance between the film's wind and the in-game storm is set by level, not by ear. Tell me if the join still pokes out.</p>
  </div>

  <h2>No pointer over the game</h2>
  <p class="ask">Also please hide the mouse when I am not in menu.</p>
  <div class="col">
    <p>The pointer is hidden during the films, in play, in the endings and over the credits. It comes back on the title screen and the pause menu, and goes away again when you resume. Checked in the test window: shown on the title, hidden in the film and in play, shown when paused.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/main.js</code></b><span><code>beginWalkOut</code> / <code>walkStep</code> and the <code>WALK</code> timings; the film starts the storm 4.2&nbsp;s before its end; the fade from black; the cursor toggle.</span></div>
      <div><b><code>app/src/audio.js</code></b><span><code>storm()</code>, <code>stormOpen()</code>, <code>stormStop()</code>: the muffled gale played past the silenced master; <code>fadeMaster()</code>.</span></div>
      <div><b><code>app/src/draw.js</code> &middot; <code>world.js</code></b><span>The door swinging on its hinges, the dark room and its floor light; her size on the sill; no hints during the walk.</span></div>
      <div><b><code>app/style.css</code></b><span><code>body.nocursor</code>.</span></div>
    </div>
  </div>
'''
print(page('walkout', 'Spindledeep · Out Into the Storm', body, PREV))
