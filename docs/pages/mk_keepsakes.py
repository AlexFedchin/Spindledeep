"""Changes page: found keepsakes and skeins are held up full screen, the world paused around them (`keepsakes/`).
The keepsake words are story: they stay behind the sealed block."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/3D4qdQVi67pjES3hUbNQeu">out into the storm</a>'
        ' &middot; <a href="https://claude.ai/artifact/Mva3aPJTUhkcPfYoeYTJVS">no hard cuts</a>')

SEAL = '''  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--italic, 'IM Fell English', serif);
      font-style: italic; text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''

body = SEAL + hero('found things', 'Held Up to the Light', 'The world stops', 'while you look at what you found') + '''
  <div class="col summary">
    <p>Finding a keepsake or a skein is now a moment of its own. Time slows to a stop and the cave darkens around her. The thing rises from where it lay into a warm light above her head, and she looks up at it. Its name, its words and the count come in one after another, in large type. It waits there until you press something, then sinks into her chest and the world moves again.</p>
  </div>

  <h2>A moment for each one</h2>
  <p class="ask">Also when I find a new collectable item - show it full screen with a description text in bigger letters than now, darken the background and pause the game until I press any button. Everything should be smooth. These collectibles should feel meaningful.</p>
  <div class="col">
''' + reveal('skein', 'skein_before.jpg', 'skein_after.jpg', 'Before: a skein picked up; a small line of capitals at the top of the screen is all that marks it', 'After: the skein held up large in a warm light, its name, a line about it and the count beneath, the cave dark around it') + '''
    <p>Before, a find was a single line of small capitals at the top of the screen, gone in three seconds. A keepsake's words ran the whole width of the screen in that small type, over the moving snow.</p>
    <figure class="solo" style="max-width:680px"><img src="img/strip.jpg" alt="Six frames: the pickup, the item rising as the screen darkens, the item held up with its words, the words fading after a key press, the item shrinking into the doll, the cave back to normal"><figcaption>The pickup &middot; rising &middot; held up &middot; a key pressed &middot; into her chest &middot; on again</figcaption></figure>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>When</th><th>What happens</th></tr></thead>
        <tbody>
          <tr><td>The pickup</td><td>Time runs down to a stop over about half a second. Music and ambience dip. A low singing bowl, and a slow harp note half a second later.</td></tr>
          <tr><td>0&ndash;1.2&nbsp;s</td><td>The item rises along a soft arc from where it lay to above her head, growing to about 2.4 times its size. The camera closes in until the view is under 3&nbsp;m tall. The screen darkens around it, and she tips her head back to look.</td></tr>
          <tr><td>0.7&nbsp;s</td><td>Its name, in large small capitals, with a red rule that draws out under it.</td></tr>
          <tr><td>1.15&nbsp;s</td><td>Its words, in large italic. The keepsakes' are the lines written for them; a skein's says the thread will now reach further.</td></tr>
          <tr><td>1.7&nbsp;s</td><td>The count: <i>skein 2 of 5</i>, <i>keepsake 3 of 8</i>, or <i>the last of them</i>.</td></tr>
          <tr><td>2.6&nbsp;s</td><td><i>press any key</i> (or <i>any button</i> on a gamepad), breathing slowly at the bottom.</td></tr>
          <tr><td>A key, button or click</td><td>Counted only after 1.6&nbsp;s and only as a fresh press, so the key you were running with can't skip it. The words fade first. The item shrinks and drops into her chest, where the red heart is, with sparks and a soft tie sound. The dark lifts, the camera eases back, and time picks up.</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>The item is the game's own drawing,</b> engraved like everything else, not a flat picture laid on top. The cave stays visible but dark, so it is still the place where you found it.</li>
      <li><b>Nothing can happen to her meanwhile.</b> The world is stopped and her controls are off. The pause key just closes it. Hints and prompts step aside.</li>
      <li><b>It never carries over.</b> Returning to the title, continuing or starting a new run clears it.</li>
    </ul>
  </div>

  <div class="col"><details class="seal">
    <summary>The keepsake screen &middot; spoilers<span>Open only when you want to see one. It shows the first keepsake's words.</span></summary>
    <div class="inner">
''' + reveal('keep', 'keep_before.jpg', 'keep_after.jpg', 'Before: the keepsake text as a thin line of small capitals across the top of the screen', 'After: the wooden spool held up large, its name and its words beneath') + '''
      <p>The Cellar's spool. The first of eight.</p>
    </div>
  </details></div>

  <h2>How it was checked</h2>
  <div class="col">
    <p>I ran it in the hidden test window: a skein in the Root Gardens and the Cellar's keepsake were picked up with real physics. The test logged the showcase's phase and timing, and that the doll stayed exactly where she was while it was up. The key press after it closed it, she ran on, and no errors came up. My first version lit the item too strongly: the skein washed out to a pale disc. The light is now about half as strong, and the yarn's turns and red show clearly.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/main.js</code></b><span><code>startShow</code> / <code>showUpdate</code>: the timing, the rise and the fall, the camera framing, time running down, and the fresh-press rule.</span></div>
      <div><b><code>app/src/props.js</code></b><span><code>drawShowItem</code>: the keepsakes and the skein drawn at any scale (<code>Pen</code> now takes a scale).</span></div>
      <div><b><code>app/index.html</code> &middot; <code>app/style.css</code></b><span>The <code>#show</code> overlay: the darkening, and the name, words and count coming in one by one.</span></div>
      <div><b><code>app/src/world.js</code> &middot; <code>draw.js</code></b><span>The warm light on the held item; it is drawn over her.</span></div>
    </div>
  </div>
'''
print(page('keepsakes', 'Spindledeep · Held Up to the Light', body, PREV))
