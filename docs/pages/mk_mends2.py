"""Changes page: the thread kept out of rock, harder hands, dirt sounds, no thread creak, no brass (`rockthread/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/Mva3aPJTUhkcPfYoeYTJVS">no hard cuts</a>'
        ' &middot; <a href="https://claude.ai/artifact/JcxvsDdLF2tCXTsmfmFfvP">held up to the light</a>')

body = '''  <style>table.windows td, table.windows th { white-space: normal; }</style>
''' + hero('thread, hands, sound', 'Kept Out of the Rock', 'The thread goes round', 'the hands do not miss') + '''
  <div class="col summary">
    <p>Four of the things you listed: the thread no longer passes through rock, the hands are a real danger, they sound like earth, and nothing made of rope keeps playing after them. The brass is gone from the Hall of Chairs and from the game. The new ending has its own page.</p>
  </div>

  <h2>The thread and the rock</h2>
  <p class="ask">Also the thread is sometimes going throught the rocks, please make sure it doesn't happen.</p>
  <div class="col">
''' + reveal('g1', 'thr1_before.jpg', 'thr1_after.jpg', 'Before: the grey thread drops straight through two rock ledges in the Throat', 'After: it lies along the top of each ledge, goes round the lip and along its underside') + '''
''' + reveal('g2', 'thr3_before.jpg', 'thr3_after.jpg', 'Before: the grey thread passes down through a ledge in the Loom', 'After: it goes round the end of the ledge') + '''
    <p>I let random players loose from every pole in the game, running, jumping, gripping and climbing, and measured how much of the drawn thread lay inside rock in every frame.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Measured</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>Frames with red thread more than 6&nbsp;cm inside rock</td><td class="n">31.4 %</td><td class="n">0.2 %</td></tr>
          <tr><td>Deepest cut found</td><td class="n">1.13 m</td><td class="n">0.11 m</td></tr>
          <tr><td>Her grey thread, length inside rock</td><td class="n">64.7 m</td><td class="n">0.2 m</td></tr>
          <tr><td>All 12 ring swings, release times that land</td><td class="n">&mdash;</td><td class="n">same results</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>Gripping.</b> A taut thread used to run straight from its last contact to the doll, through whatever was between. It now follows the way the thread already lay, bending at each corner.</li>
      <li><b>Lying loose.</b> The pieces between the thread's points are kept out of rock too, not only the points. A piece that would jump across a thin ledge is put back where it was.</li>
      <li><b>Tying.</b> The last stretch to a pole is laid round a lip instead of jumping across it.</li>
      <li><b>Drawing.</b> Anything that would still cut a corner is drawn along the rock's face, so old saves look right too. The wave from a pluck can no longer throw the thread into the rock under it.</li>
      <li><b>The 11 cm left over</b> is a few rare frames on a loose, fast-moving thread. I could not bring it to exactly zero.</li>
    </ul>
  </div>

  <h2>The hands</h2>
  <p class="ask">Also please make the hands a bit harder, right now I can just walk past them and not a single one touches me with 0 effort.</p>
  <div class="col">
''' + reveal('h1', 'hush_before.jpg', 'hush_after.jpg', 'Before: one thin sleeve with a disc for a hand, hanging far above the doll', 'After: arms with real hands; one from the roof has her and another is coming up out of the floor') + '''
    <p>They used to creep out at less than your running speed, and one pluck every three seconds kept all of them away. Now the earth crumbles for half a second, then an arm bursts out at where you are going to be.</p>
    <ul class="what">
      <li><b>Pluck when the earth crumbles.</b> A pluck drives off a hand that has already stirred and buys about a second. Plucking ahead of time does nothing, and hammering the key only tears you free.</li>
      <li><b>If one gets you,</b> it drags you to the rock. Pluck to tear loose, which costs some yarn. You have one second.</li>
      <li><b>More of them,</b> including seven that come up out of the floor of the long gallery. Never more than two at once, never two warnings together.</li>
      <li><b>Lit bells</b> still keep them down.</li>
    </ul>
    <div class="tablebox" style="margin-top:16px">
      <table class="windows">
        <thead><tr><th>Bots crossing the Hush, 12 runs each</th><th>First half</th><th>Long gallery</th></tr></thead>
        <tbody>
          <tr><td>Just walking (before: got through untouched)</td><td>0 of 12 survive</td><td>0 of 12 survive</td></tr>
          <tr><td>Plucking 0.35 s after each warning</td><td>12 of 12, never caught</td><td>12 of 12, caught twice a run</td></tr>
          <tr><td>Never plucking until caught</td><td>12 of 12, caught 4 times</td><td>12 of 12, caught 3 to 4 times</td></tr>
          <tr><td>Hammering the key</td><td>12 of 12, caught 4 to 5 times</td><td>12 of 12, caught twice</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>Sound</h2>
  <p class="ask">please make sure there is no contant thread tension sound playing, after the hands popping out there is always some thread sound which is irritating. And the hands popping out should make some dirt sound, not the thread sound.</p>
  <div class="col">
    <ul class="what">
      <li><b>What you were hearing.</b> Every hand that reached out started a 28-second recording of creaking rope, played at half speed, so it ran for nearly a minute, and each hand added another. The heddles in the Treadles did the same. All of that is gone.</li>
      <li><b>No rope loops left.</b> The creak while swinging is removed, and the creak inside the Treadles' background beat is replaced with wood. The sound for a thread pulled tight plays at most once in eight seconds.</li>
      <li><b>The hands</b> now trickle crumbs as the warning, then burst: a low thump, dug soil, falling stones and gravel.</li>
    </ul>
  </div>

  <h2>The brass</h2>
  <p class="ask">And please, remove those trumpets music from the chairs room and never use it again in this game.</p>
  <div class="col">
    <p>The track was Kevin MacLeod's &ldquo;Peaceful Desolation&rdquo;. Its file, its build recipe and its credit are deleted, and the project notes say not to use it or any brass. The Hall of Chairs has no music now: a low room tone, wood settling now and then, and very far down something like people talking, too low to make out.</p>
  </div>

  <h2>How it was checked</h2>
  <div class="col">
    <p>The thread, the hands and the routes were checked by running the game's real physics outside the window, thousands of simulated seconds at a time. The pictures come from the hidden test window. I can't listen, so the sounds were checked by their spectrograms and levels: please tell me if one of them sits wrong.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/route.js</code></b><span>New: how deep a line runs into rock, the way round it, and laying a line along the rock's face.</span></div>
      <div><b><code>app/src/thread.js</code> &middot; <code>world.js</code></b><span>Gripping, wrapping, tying and drawing use it; her grey thread too.</span></div>
      <div><b><code>app/src/deep.js</code></b><span><code>HAND</code>: every timing of the hands in one line.</span></div>
      <div><b><code>app/src/audio.js</code> &middot; <code>scripts/audio/build_audio.py</code></b><span>The new sounds and how they are built; the old music removed.</span></div>
    </div>
  </div>
'''
print(page('rockthread', 'Spindledeep · Kept Out of the Rock', body, PREV))
