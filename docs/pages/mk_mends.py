"""Changes page: the four short fixes of 2026-11-23 (`mends/`): thread cut at the Ink Mere, red thread on a new run,
the floating chair, and the end music."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/MswAJ32Cd7SY1zfuP2jvV1">her own two hands</a>'
        ' &middot; <a href="https://claude.ai/artifact/KQdLD1viJRnYPpcjy6WBMh">seventy winters in her voice</a>')

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero(
    'four mends', 'Four Small Mends', 'The short list, done first', 'before the long work on the deep') + '''
  <div class="col summary">
    <p>You listed four short problems: the thread breaking at the ink islands, the red thread carrying over into a new game, the chair floating in the Loom, and the trumpets at the end. All four are fixed and checked in the game. The model, the longer game, the Loom and the ending are the long work, and they get their own pages.</p>
  </div>

  <h2>The thread at the ink islands</h2>
  <p class="ask">Something is constantly destroying the thread in the part where I jump over the holes with water, there are no moths and I don't seem to be able to avoid it.</p>
  <div class="col">
    <p>The culprit was the ink dripping from the stalactites. Two of them hang right over islands you have to cross. Your thread lies across those islands behind you, and any drop that landed on it cut it at once. A drop falls every three or four seconds. The cut only showed when your next swing caught nothing and you fell into the ink just short of the next island. Your own session logs show it: about thirty ink deaths across two evenings, nearly all at the same two spots (x&nbsp;81.5 and x&nbsp;70.4).</p>
    <p>I reproduced it with a test that plays the whole crossing from the shore pole with real physics, drips on and the thread kept behind you as in play:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Crossing, shore to the sixth island</th><th>Before</th><th>After</th></tr></thead>
        <tbody>
          <tr><td>Runs that got across</td><td>1 of 10</td><td>15 of 16</td></tr>
          <tr><td>Thread cut by a drip</td><td>9 times, under the drips at x&nbsp;89 and x&nbsp;46</td><td>never</td></tr>
          <tr><td>Thread eaten by the ink itself</td><td>never</td><td>never</td></tr>
          <tr><td>Remaining failure</td><td>&mdash;</td><td>a drop hit the doll mid-swing; you can see it falling and time the swing</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>Drops now splash off the yarn.</b> They still kill the doll if they hit her, so the drips are still a hazard you can see coming and dodge.</li>
      <li><b>The ink itself still eats thread that dips into it.</b> In the test it never did, because the thread hangs above the surface.</li>
    </ul>
  </div>

  <h2>A new game starts grey</h2>
  <p class="ask">After starting the game again the thread that we are following remains red, even though it should be grey since it is a new game.</p>
  <div class="col">
    <p>The ending's red pulse up her thread was stored outside the world. A new game built a fresh world but never cleared it, so her thread came back red. It's now cleared when a new game begins and when you return to the title. The title also shows a fresh cottage, not the last run's lit window. Tested: tie at the end, let the pulse climb, then begin again. The pulse is gone and the thread is grey.</p>
  </div>

  <h2>The chair stands on the floor</h2>
  <p class="ask">The chair in the end is floating in the air, fix it.</p>
  <div class="col">
''' + reveal('chair', 'chair_before.jpg', 'chair_after.jpg', 'Before: chair, spool and candle hang about 1.7 m above the Loom floor', 'After: they rest on the floor') + '''
    <p>The chair, the spool and the candle were drawn at the height of the end of her grey thread, which was pinned in mid-air. The thread now ends on the floor, and the chair, spool and candle are placed on the ground the game finds under them.</p>
  </div>

  <h2>No more trumpets</h2>
  <p class="ask">Please remove that heroic trumpets music from the end of the game, it is completely unsuitable.</p>
  <div class="col">
    <p>That was a stock orchestral cue ("Heartbreaking"). It played from the tie, through the epilogue film and under the credits. It's gone from all three. In its place is a dirge made from the game's own sounds:</p>
    <ul class="what">
      <li>a low drone a semitone against itself, so it beats slowly like breath through cloth</li>
      <li>the singing bowl two octaves down, struck like a distant gong</li>
      <li>the harp picking a falling line that stops before it gets home</li>
      <li>the broken music box far off, played backwards and slowed until it drags</li>
    </ul>
    <p style="margin-top:14px">Nothing in it rises or resolves. Most of its sound sits below 200&nbsp;Hz (75%, against 5% for the old cue). The epilogue film was re-cut with the new soundtrack; the picture is unchanged.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/world.js</code></b><span>Drops splash off the thread; the chair, spool and candle find the floor.</span></div>
      <div><b><code>app/src/main.js</code></b><span>The ending state is cleared on a new game and at the title.</span></div>
      <div><b><code>app/src/level.js</code> &middot; <code>draw.js</code></b><span>Her grey thread ends on the floor; the chair, spool and candle are drawn on the ground.</span></div>
      <div><b><code>scripts/audio/build_audio.py</code></b><span>The new <code>mus_end</code> recipe; <code>app/assets/cine/outro.mp4</code> re-cut with it.</span></div>
    </div>
  </div>
'''
print(page('mends', 'Spindledeep · Four Small Mends', body, PREV))
