"""Changes page: the monster is a real 3D figure (`face/`). Plot sealed."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/J1avXLArMvcKdXb2hRBTGz">what is down there</a>'
        ' &middot; <a href="https://claude.ai/artifact/NZ8LqQVJhCyzqS1shjTGD7">listen</a>')
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
B = 'The old picture'
body = SEAL + hero('the ending', 'A Real Body', 'No more pictures', 'it can turn its head') + '''
  <div class="col summary">
    <p>The monster was photographs cut out and moved about. It is now a 3D model with a skeleton, posed and lit inside the game every frame and then engraved like everything else. It is using a model we already had; any model you give me can replace it.</p>
  </div>

  <h2>Can a 3D model make it better</h2>
  <p class="ask">Do you think you can make it better if I give you some 3d model so that you don't have to manipulate images?</p>
  <div class="col">
    <p>Yes, and the part of the game that draws one is built. What it needs from a model:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>What</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Rigged: FBX, GLB or .blend, with a skeleton for arms, legs, spine, neck and head</td><td>Without bones it can only stand there. Fingers and a jaw that opens matter most for this one.</td></tr>
          <tr><td>Up to about 60,000 triangles</td><td>It is drawn live. The present one is 25,000 and the game stays at 60 frames a second.</td></tr>
          <tr><td>A colour texture, and a normal map if there is one</td><td>Only the light and dark of it is used. Wrinkles, veins and ribs in the normal map show well in the engraving.</td></tr>
          <tr><td>Animations: not needed</td><td>The movement is made in the game, so it can hold the thread and fit the rock.</td></tr>
          <tr><td>A licence that allows use in a game</td><td>The repository on GitHub is public, so the model files stay out of it and only go into the built game.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>The scenes</h2>
  <div class="col"><details class="seal">
    <summary>What was wrong, and before and after<span>The end of the game. Anyone who has not been there should play first.</span></summary>
    <div class="inner">
  <p class="ask">Also why when I get asked to either bite the thread or tie it there is this weird picture of human climbing? Shouldn't it be our knitter aka the monster pretending to be the knitter? And why when it climbs out it is just a pale gradient with a bunch of hands?</p>
    <ul class="what">
      <li><b>The human at the choice</b> was one still picture of a person on all fours, twelve metres tall, standing over the place. You were meant to take its limbs for pillars. The camera showed most of it, so it read as someone climbing. You are right about who it should be, and now it is.</li>
      <li><b>The hands</b> were one picture of an arm, bent nine ways and cut off at the back, coming out of a round patch of dark. The patch had to be darker than the cave to hide the cut ends. Wherever the cave was already dark, or the sky was light, you saw the patch itself, and the arms were drawn over the rock.</li>
      <li><b>Her face.</b> This model is younger in close-up than the voice is, and she has a knitted cap. That is the model, and a reason to replace it.</li>
    </ul>
''' + reveal('choice', 'choice_before.jpg', 'choice_after.jpg', B, 'The knitter kneels, holding out the thread') + '''
    <p>The choice. She kneels at the edge of the dark with the end of her thread held out. The longer you stay, the nearer she leans, on a neck that is not quite the length it was.</p>
''' + reveal('reveal', 'reveal_before.jpg', 'reveal_after.jpg', B, 'The neck arches up and comes down over the doll') + '''
    <p>Tied. Still kneeling, still holding the thread, larger; the neck goes up into the dark and comes down over the doll a joint at a time, head the wrong way up.</p>
''' + reveal('talk', 'talk_before.jpg', 'talk_after.jpg', B, 'The knitter&rsquo;s face, speaking') + '''
    <p>The mouth is a jaw that opens, not six pictures crossfaded. It opens a good deal further at the end.</p>
''' + reveal('climb', 'climb_before.jpg', 'climb_after.jpg', 'Arms out of a dark patch', 'A whole body going along the thread') + '''
    <p>The way up. A whole body: each hand and foot takes one place on the thread and holds it while the rest goes past. The arms stretch as far as they must, the head stays out of the rock, and once in every place it looks out at you.</p>
''' + reveal('home', 'home_before.jpg', 'home_after.jpg', 'Arms out of a dark patch by the cottage', 'It arrives at the cottage') + '''
    <p>The same figure also comes up the far wall during the rising dark, and is there for the half second of light when you bite the thread.</p>
    </div>
  </details></div>

  <h2>How it is drawn</h2>
  <div class="col">
    <ul class="what">
      <li><b>Lit by the cave.</b> The thread, the candle and the lamps light it from where they are, so one side of a face is red and the other black.</li>
      <li><b>Engraved round the form.</b> The lines bend with the surface, and the rock hides what is behind it.</li>
      <li><b>Still pictures left.</b> The hands in the Hush, the people on the Loom&rsquo;s floor and the arms in the rising dark. They go the same way if you find models for them, or one model of a person.</li>
    </ul>
    <p>Checked by running both endings in the hidden test window, the tied one through to its film: no errors, 60 frames a second before and after. The film after the ending was not touched.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/figure.js</code></b><span>New. Skeleton, limbs, the neck, and the poses.</span></div>
      <div><b><code>app/src/stage.js</code></b><span>New. Which figure is where and doing what.</span></div>
      <div><b><code>app/src/renderer.js</code> &middot; <code>shaders.js</code></b><span>The figure pass and its engraving.</span></div>
      <div><b><code>app/src/ending.js</code></b><span>The scenes, rewritten for a body.</span></div>
      <div><b><code>scripts/figures/export.py</code></b><span>A rigged model in, the game&rsquo;s format out.</span></div>
    </div>
  </div>
'''
print(page('face', 'Spindledeep · A Real Body', body, PREV))
