"""Changes page: the camera breathes with the cave (zoom by room size) and the doll can look up and down (`camera/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/WvqLyGh8TYMumLFxf7kzcc">four small mends</a>'
        ' &middot; <a href="https://claude.ai/artifact/7RuHZ4rS7YwJKUTTZ9ZKDt">her, at last</a>'
        ' &middot; <a href="https://claude.ai/artifact/9FAgaVuMKJjeRyNrvpxfRS">much deeper</a>')

body = hero('the camera', 'The Cave Breathes', 'Close in the cracks', 'wide in the halls') + '''
  <div class="col summary">
    <p>The camera now reads the cave around the doll. In a tight crack it closes in, and in the great halls it eases out until the whole space shows. Standing still, W or S (or the arrow keys) turns her head up or down, and a moment later the view follows her gaze.</p>
  </div>

  <h2>The view follows the room</h2>
  <p class="ask">Make the camera a bit more dynamic and interesting in the game, the scale should change depending on the size of the room around. For huge rooms the camera should smoothly zoom out, for narrow corridors the camera should zoom in to feel more claustrophobic.</p>
  <div class="col">
    <p>Every frame the game sends 24 rays out from the doll through the cave walls and averages how far they get. It uses a geometric mean, so a low ceiling or a wall at her shoulder counts for more than one long sightline down a shaft. I measured this at every place in the game you can stand. It runs from about 1&nbsp;m in the tightest crawls to 12&nbsp;m and more in the Ink Mere and the Loom, with a typical room near 5.7&nbsp;m. Each area keeps its own base view, and the camera scales it by how this spot compares with that typical room: down to two-thirds in a crack, up to about 1.4&times; in a hall.</p>
''' + reveal('narrow', 'narrow_before.jpg', 'narrow_after.jpg', 'Before: a narrow chasm in the Root Gardens at the usual distance', 'After: the camera has closed in on the chasm') + '''
    <p>A crack in the Root Gardens: the view closes from 16&nbsp;m tall to 12&nbsp;m, and the walls press in.</p>
''' + reveal('medium', 'medium_before.jpg', 'medium_after.jpg', 'Before: a room in the Throat', 'After: nearly the same, slightly closer') + '''
    <p>An ordinary room in the Throat hardly changes (19&nbsp;m to 18&nbsp;m). Typical rooms keep the framing you are used to.</p>
''' + reveal('mere', 'mere_before.jpg', 'mere_after.jpg', 'Before: the Ink Mere at the usual distance', 'After: the camera has drawn back over the Mere') + '''
    <p>Over the Ink Mere the view draws back from 19&nbsp;m to 27&nbsp;m. More of the islands and the drips ahead are in sight before you swing for them.</p>
''' + reveal('loom', 'loom_before.jpg', 'loom_after.jpg', 'Before: the Loom at the usual distance', 'After: the camera has drawn far back in the Loom') + '''
    <p>The Loom is the widest place in the game, so it opens furthest (23&nbsp;m to 31&nbsp;m, the cap). The close shot on her at the very top of the Loom is unchanged.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Where</th><th>Open space around her</th><th>View height before</th><th>After</th></tr></thead>
        <tbody>
          <tr><td>A crack in the Root Gardens</td><td>3.2 m</td><td>16 m</td><td>12 m</td></tr>
          <tr><td>A room in the Throat</td><td>5.1 m</td><td>19 m</td><td>18 m</td></tr>
          <tr><td>The Bell Gallery pillars</td><td>10.3 m</td><td>19 m</td><td>25 m</td></tr>
          <tr><td>The Ink Mere</td><td>12.2 m</td><td>19 m</td><td>27 m</td></tr>
          <tr><td>The Loom</td><td>16.4 m</td><td>23 m</td><td>31 m</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>It is slow on purpose.</b> The measurement is smoothed over about a second, and the zoom itself takes a few more, so running past a pillar or under an arch doesn't make the view pump. It drifts in as you enter a passage and opens as you come out into a hall.</li>
      <li><b>Hidden rooms count as rock.</b> A room you haven't found yet would otherwise make the view widen beside it and give it away.</li>
      <li><b>Swinging still adds its extra margin</b> on top, as before. After a respawn or a load the view takes the new room's measure at once, with no slow drift from where you were.</li>
    </ul>
  </div>

  <h2>Looking up and down</h2>
  <p class="ask">Also pressing s (or arrow down) should make the doll look down and pan the camera a bit down. Same for w/arrow up.</p>
  <div class="col">
    <figure class="solo" style="max-width:680px"><img src="img/heads.jpg" alt="Three close-ups of the doll: head tipped back looking up, level, and chin down looking down"><figcaption>Looking up, level, looking down</figcaption></figure>
    <p>Her head turns on the neck at once. If you keep holding the key for a fifth of a second, the view glides a third of the screen down (or a quarter up) and stays there while you hold it. When you let go, both settle back. The short delay means a quick tap doesn't jerk the camera.</p>
''' + reveal('down', 'look_down0.jpg', 'look_down.jpg', 'The Bell Gallery pillars, standing level', 'Holding S: the view has panned down below the pillar tops', 'Level', 'Holding S') + '''
''' + reveal('up', 'look_up0.jpg', 'look_up.jpg', 'The Ink Mere, standing level', 'Holding W: the view has panned up toward the roof', 'Level', 'Holding W') + '''
    <p>You can look only while standing free. W and S already reel the thread when you grip it, climb ropes, and lower you over a lip, and all of that works as before. Gamepad stick and d-pad up/down look too.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/main.js</code></b><span><code>openness()</code> and the <code>OPEN</code> settings (rays, typical room, zoom limits); the look timer and pan in <code>updateCamera</code>.</span></div>
      <div><b><code>app/src/draw.js</code></b><span>The doll's head turns on her neck with <code>player.look</code>.</span></div>
    </div>
  </div>
'''
print(page('camera', 'Spindledeep · The Cave Breathes', body, PREV))
