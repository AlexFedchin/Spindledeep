"""Changes page: the ending remade (`ending/`). Plot and pictures behind the sealed block."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/JcxvsDdLF2tCXTsmfmFfvP">held up to the light</a>'
        ' &middot; <a href="https://claude.ai/artifact/R161kCaf6HSZvYkHuLaabt">kept out of the rock</a>')

SEAL = '''  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--fell); font-style: italic;
      text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''

body = SEAL + hero('the ending', 'What Is Down There', 'The end is new', 'from the Loom to the last card') + '''
  <div class="col summary">
    <p>Everything from the floor of the Loom to the last card is remade: the Loom itself, the finale, both endings, the film and what comes after the credits. The old woman's model is not in any of it. What is down there is never explained; why it calls names, what your two choices do and what happens to the knitter and the doll now are.</p>
    <p>The pictures and the plot are sealed below; I'd play it first. Finishing the old ending cleared your save, so I added <code>to-the-loom.cmd</code> in the game's folder: it opens the game with <i>Go to the Loom</i> on the title menu. From now on a run keeps its save after an ending, so Continue takes you back to the choice and you can see the other one.</p>
  </div>

  <h2>What changed, without the plot</h2>
  <p class="ask">What you did for the ending of this game is not terrifying or even scary, but rather super cringe. I need you to completely remake it to something actually terrifying, unexplainable and pure horror.</p>
  <div class="col">
    <ul class="what">
      <li><b>The Loom.</b> The giant figure, the faces in the cloth and the rising cloth are gone. The floor, the climb and the top are all something else. The route and its timing are the same.</li>
      <li><b>The finale.</b> Mostly darkness, stillness and long silences. There is exactly one loud moment in the whole ending, and only in one of the two.</li>
      <li><b>The film.</b> New from the first frame to the last, 40 seconds, with no music and none of the old shots.</li>
      <li><b>After the credits</b> of one ending there is something new. Don't skip it.</li>
      <li><b>Music.</b> None after you reach the Loom, and none over the credits.</li>
    </ul>
  </div>

  <h2>Clear, this time</h2>
  <p class="ask">And also make the ending clearer regarding why something was calling names, what choices I have in the end and what happens with the knitter and the doll. Right now it is ambiguous.</p>
  <div class="col">
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Your question</th><th>Where it is answered</th></tr></thead>
        <tbody>
          <tr><td>Why it calls names</td><td>Three knots on the way down, at the Ink Mere, the Hall of Chairs and the Treadles, each one piece of it, and one keepsake. They build on each other and don't contradict.</td></tr>
          <tr><td>What it wants</td><td>The last knot, on the floor of the Loom, says it in plain words. Nothing attacks until it has finished speaking.</td></tr>
          <tr><td>What my choices are</td><td>Both are shown on screen together, each with a line saying what it does. The key is held for over a second, so neither can be pressed by accident.</td></tr>
          <tr><td>What happens to the knitter and the doll</td><td>Four or five cards at the end of each ending say so directly, one sentence each.</td></tr>
        </tbody>
      </table>
    </div>
    <ul class="what" style="margin-top:16px">
      <li><b>Four knots were rewritten and re-recorded,</b> and eight new lines added. The other seven knots and the prologue are untouched; the first knot in the game now means something different by the end.</li>
      <li><b>The &ldquo;she was made, too&rdquo; thread is gone.</b> It was most of the muddle. Four keepsakes have new words.</li>
    </ul>
  </div>

  <div class="col"><details class="seal">
    <summary>The ending, with pictures &middot; spoilers<span>Open only after you have seen it.</span></summary>
    <div class="inner">
''' + reveal('rise', 'rise_before.jpg', 'rise_after.jpg', 'Before: the old woman as a giant rising out of the cloth', 'After: arms in the dark, and something pale coming up the far wall on all fours') + reveal('fin', 'fin_before.jpg', 'fin_after.jpg', 'Before: the old woman seated on a block beside a candle', 'After: the doll, tiny, between bare feet and legs that go up out of the light') + '''
      <p><b>Why names.</b> A child fell down the well and called for her mother. Something listened, and learned that when you call a name, someone comes down. It sits whoever comes in a chair and asks who they miss; that is how it gets the next name. The knitter's husband said hers.</p>
      <p><b>The choice.</b> It cannot climb. It needs one thread from the bottom to the top, and you have laid it one. The knitter is already dead; the voice is bait. Tie, and it climbs out. Bite your own thread, and it never can, and the doll stays. She was never given a name, so it cannot call her.</p>
      <figure class="solo" style="max-width:680px"><img src="img/reveal.jpg" alt="A gigantic pale figure on all fours stands over the doll, its head lowered on a lengthening neck"><figcaption>What was standing over the place the whole time</figcaption></figure>
      <figure class="solo" style="max-width:680px"><img src="img/choice.jpg" alt="The choice, shown as two columns at the bottom of the screen"><figcaption>The choice</figcaption></figure>
      <figure class="solo" style="max-width:680px"><img src="img/strip.jpg" alt="Nine frames of the two endings"><figcaption>The two endings, in frames</figcaption></figure>
      <figure class="solo" style="max-width:680px"><img src="img/film.jpg" alt="The film's plates"><figcaption>The film</figcaption></figure>
    </div>
  </details></div>

  <h2>How it was checked</h2>
  <div class="col">
    <p>Both endings were run from the choice to the credits in the hidden test window, with a held key for each, and the film played through. The climb through the Loom was replayed by the physics bot at several timings: it is winnable, at the same pace as before. Every recorded line was transcribed back and matched against the script. I can't hear it or be frightened by it, so whether it lands is for you to say.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/ending.js</code></b><span>The approach, the held choice, both timelines, the closing cards.</span></div>
      <div><b><code>app/src/drawend.js</code> &middot; <code>deep.js</code></b><span>Everything new in the Loom and at its top, and the hands.</span></div>
      <div><b><code>scripts/art/caller.py</code> &middot; <code>facework.py</code> &middot; <code>cutout.py</code></b><span>The pictures it is drawn from.</span></div>
      <div><b><code>scripts/cine/plates.py</code> &middot; <code>edit.py</code></b><span>The film.</span></div>
      <div><b><code>scripts/voice/lines.py</code></b><span>The lines. <code>docs/STORY.md</code> has the whole plot (spoilers).</span></div>
    </div>
  </div>
'''
print(page('ending', 'Spindledeep · What Is Down There', body, PREV))
