"""Changes page: the user's rigged old-lady model replaces the hand-built knitter (`oldlady/`)."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/KQdLD1viJRnYPpcjy6WBMh">seventy winters in her voice</a>'
        ' &middot; <a href="https://claude.ai/artifact/WvqLyGh8TYMumLFxf7kzcc">four small mends</a>')

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero(
    'the knitter', 'Her, at Last', 'The model you found', 'in every shot she was in, and in the game') + '''
  <div class="col summary">
    <p>The rigged old lady you downloaded is now the knitter. She replaces the figure I had built out of spheres and tubes in every film shot she appears in: five in the prologue and two in the epilogue. Both films were re-rendered and re-cut. She also appears in the game itself now, in the deep. I've left her out of this page so you meet her there.</p>
  </div>

  <h2>In the prologue</h2>
  <p class="ask">I've downloaded a 3D model of an old lady, I think she fits quite well. It's in the folder next to the repo, it's fully rigged. Please use it in the game.</p>
  <div class="col">
''' + reveal('i3', 'i3_before.jpg', 'i3_after.jpg', 'Before: the hand-built knitter stitching the doll', 'After: the model stitching the doll') + '''
''' + reveal('i5', 'i5_before.jpg', 'i5_after.jpg', 'Before: hand-built hands tying the red thread round the doll', 'After: her hands') + '''
''' + reveal('i6', 'i6_before.jpg', 'i6_after.jpg', 'Before: the hand-built knitter at the door', 'After: the model at the door') + '''
''' + reveal('i2', 'i2_before.jpg', 'i2_after.jpg', 'Before: silhouette in the window', 'After: her silhouette in the window') + '''
    <p>The epilogue shots she is in were redone the same way. They're not shown here, as you asked.</p>
  </div>

  <h2>How she moves</h2>
  <div class="col">
    <p>Every shot was written for the old figure's joints: a stoop, a nod of the head, arms placed by inverse kinematics, and fingers curled into a relaxed hand, a hold, a grip or a pinch. Rather than re-animate every shot by hand, I rebuilt that same invisible skeleton at <i>her</i> joints, taken from her rig, and every bone of the model follows it. So the shots pose her exactly as they posed the old figure, but with her arm lengths, her shoulders and her real five-fingered hands. Her face, cap, scarf and clothes are the model's own.</p>
    <ul class="what" style="margin-top:14px">
      <li><b>Her spine bends across three bones</b> rather than at the hips, so the stoop is a curve.</li>
      <li><b>Her right hand works like a real right hand.</b> The old figure's was secretly a mirrored left hand; every wrist and finger pose written for it is converted on the fly.</li>
      <li><b>She's a little smaller than the model</b> (87%, about 1.55&nbsp;m to the top of her cap), so she fits the cottage's furniture.</li>
    </ul>
  </div>

  <h2>Checked for clipping</h2>
  <div class="col">
    <p>Her arms are fuller than the old figure's, so the clipping checker (now able to split her skinned meshes into arms, head and body by bone weights) found new problems: forearms through the table and hands into each other while knitting, a palm through the doll, a sleeve brushing her face. Each was fixed by moving the hands or the head, then re-checked:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Shot</th><th>First check with the model</th><th>After fixes</th></tr></thead>
        <tbody>
          <tr><td>Knitting at the window</td><td>hands through each other and the knitting</td><td>clean</td></tr>
          <tr><td>Stitching the doll</td><td>palm through the doll's head; sleeve through her own face</td><td>fingertips on the doll, a sleeve touching her cap</td></tr>
          <tr><td>Looking up at the window</td><td>both forearms through the table</td><td>clean</td></tr>
          <tr><td>Tying the red thread</td><td>forearms through the table; one hand into the doll</td><td>table clean; the far hand touches the doll's back, hidden from the camera</td></tr>
          <tr><td>At the door, walking out</td><td>clean</td><td>clean</td></tr>
          <tr><td>Two epilogue shots</td><td>a hand into the doll</td><td>clean</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>scripts/cine/oldlady.py</code></b><span>Imports the model, builds the control skeleton at her joints and makes her bones follow it.</span></div>
      <div><b><code>scripts/cine/lib.py</code></b><span><code>knitter()</code> now builds her; the old figure is kept as <code>knitter_proc</code> (<code>USE_MODEL = False</code> brings it back).</span></div>
      <div><b><code>scripts/cine/sprites.py</code></b><span>Renders the pictures of her the game uses, as grey tone for the engraving.</span></div>
      <div><b><code>scripts/cine/clipcheck.py</code></b><span>Splits the model's meshes by bone weight so arms, head and body can be tested against each other.</span></div>
      <div><b><code>../old-lady-fbx/</code></b><span>The model stays where you put it; the scripts read it from there. It's not copied into the repo.</span></div>
    </div>
  </div>
'''
print(page('oldlady', 'Spindledeep · Her, at Last', body, PREV))
