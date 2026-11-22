"""Changes page: the knitter rebuilt, and her hands doing the work in the prologue (`knitter/`).
Usage: python mk_knitter.py <scratchpad>   (expects intro_v2.mp4 there = the prologue before this change, and graded
K1/K2/K3 review stills in <scratchpad>/kfull_K*/0001.png). The epilogue is not shown (standing rule)."""
import os, sys, subprocess
from PIL import Image
from mkpage import page, reveal, hero, HERE

SCR = sys.argv[1]
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
NEW = os.path.join(ROOT, 'app', 'assets', 'cine', 'intro.mp4')
OLD = os.path.join(SCR, 'intro_v2.mp4')
D = os.path.join(HERE, 'knitter', 'img')
os.makedirs(D, exist_ok=True)
PREV = (' &middot; <a href="https://claude.ai/artifact/RqUUscR5hSEKuRaCpLP4Rm">clean films, kept runs</a>'
        ' &middot; <a href="https://claude.ai/artifact/WB3XZc4gqW8iqyPkNFtitx">the ghost on the title screen</a>')
START = {'I2': 152, 'I3': 272, 'I4': 464, 'I5': 598, 'I6': 742}


def grab(mp4, n, out, crop=None, w=1200):
    tmp = os.path.join(SCR, '_grab.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-vf', f'select=eq(n\\,{n})', '-vsync', '0', '-frames:v', '1', tmp], check=True)
    im = Image.open(tmp).convert('RGB')
    if crop:
        W, H = im.size
        im = im.crop((int(crop[0] * W), int(crop[1] * H), int(crop[2] * W), int(crop[3] * H)))
    im.resize((w, round(im.height * w / im.width), ), Image.LANCZOS).save(os.path.join(D, out), quality=86)


def still(src, out, w=1200):
    im = Image.open(src).convert('RGB')
    im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(os.path.join(D, out), quality=88)


cmp = [('sew1', 'I3', 40, 'The last stitch, needle in', 'the needle sat in the doll\'s eye with nobody holding it'),
       ('sew2', 'I3', 66, 'The last stitch, the pull', 'the needle rose out of the eye on its own'),
       ('lift', 'I5', 132, 'Lifting the doll', 'the doll floated up off the table by itself'),
       ('window', 'I2', 70, 'At the window, from outside', 'a plain silhouette with no hands to speak of'),
       ('shoulder', 'I4', 100, 'Over her shoulder', 'an egg-shaped head under a shawl')]
for k, sh, f, *_ in cmp:
    grab(OLD, START[sh] + f, f'{k}_before.jpg')
    grab(NEW, START[sh] + f, f'{k}_after.jpg')
for k in ('K1', 'K2', 'K3'):
    still(os.path.join(SCR, f'kfull_{k}', '0001.png'), f'{k.lower()}.jpg')

sl = ''
for k, sh, f, title, before in cmp:
    sl += f'''
  <h3>{title}</h3>
{reveal(k, f'{k}_before.jpg', f'{k}_after.jpg', f'Before: {title.lower()}, {before}', f'After: {title.lower()}, her hands doing it')}    <p>Before, {before}.</p>
'''

body = '  <style>table.windows td, table.windows th { white-space: normal; vertical-align: top; }</style>\n' + hero(
    'cinematics', 'Her Own Two Hands', 'The knitter, rebuilt in detail', 'and in the prologue it is her hands that sew and lift') + f'''
  <div class="col summary">
    <p>The old knitter was a handful of plain shapes: an egg for a head, a cone for a skirt, tubes with a ball on the end for arms. She's been rebuilt from scratch. She has a face, spectacles, grey hair in a bun, a cardigan over her dress, an apron, a fringed shawl, and arms that bend at the shoulder, elbow and wrist, ending in hands with jointed fingers.</p>
    <p>In the prologue's sewing shot she now holds the needle herself. Her right hand pinches it and draws each stitch while her left hand steadies the doll. In the next shot it's her hands, not thin air, that take the doll by its sides and lift it.</p>
  </div>

  <h2>The new model</h2>
  <p class="ask">Please make the model for the owner of the doll much more detailed. And the sewing scene in the intro is just the needle moving by itself, the owner should hold it and move arms and hands.</p>
  <div class="col">
    <figure class="solo"><img src="img/k2.jpg" alt="The knitter's face and shoulders, engraved: round spectacles, a long nose, heavy-lidded eyes, a lace collar and a buttoned cardigan"><figcaption>Face and shoulders (a review still, not in the film)</figcaption></figure>
    <figure class="solo"><img src="img/k1.jpg" alt="The knitter seated at her table in the engraved style"><figcaption>Seated at the table</figcaption></figure>
    <figure class="solo"><img src="img/k3.jpg" alt="The knitter standing, from three-quarters, with her shawl, apron and long skirt"><figcaption>Standing</figcaption></figure>
    <ul class="what">
      <li><b>Body:</b> one smooth shape with the stoop of an old woman: hips, a soft belly, a narrow chest and a rounded upper back. Seated, her thighs, knees, shins and shoes are all there. Standing, she wears a long folded skirt over stockings.</li>
      <li><b>Face:</b> nose, brow, cheeks and chin, heavy-lidded eyes with bags under them, ears, the lines beside the mouth, and round wire spectacles with arms back to her ears. Grey hair is pulled back into a bun held by a pin.</li>
      <li><b>Clothes:</b> a knitted cardigan, open down the front over a dark dress, with buttons and pockets; a lace collar; a linen apron; and a shawl over her shoulders with a fringe along its hem.</li>
      <li><b>Arms and hands:</b> they bend at shoulder, elbow and wrist. Each hand has a palm, knuckles and veins, four two-jointed fingers and a thumb. The fingers take poses: relaxed, holding, gripping, or pinching between thumb and index.</li>
    </ul>
  </div>

  <h2>Her hands do the work</h2>
  <div class="col">
    <p>Her arms are aimed with a small two-joint solver: give it where the hand must be, and it works out the shoulder and elbow, with the elbow bending out to the side like a real arm. In the sewing shot it runs every frame, so her hand follows the needle through the whole stitch.</p>
{sl}
    <ul class="what" style="margin-top:16px">
      <li><b>Sewing:</b> she leans in over the table. Her right hand pinches the needle near its back end, sets the tip at the button eye and draws the red thread out to the side. Her left hand cups the doll's head.</li>
      <li><b>Lifting:</b> her hands rest on the table while the loop is tied, then reach in. The doll lifts its little arms, and she takes it by the sides and raises it as she looks up.</li>
      <li><b>Elsewhere in the prologue:</b> at the window she knits with a pair of needles. Leaving, she grips the lantern by its handle, and the grey thread runs from her other hand.</li>
      <li><b>In the epilogue</b> her hands are on the doll too. I'm not showing that shot here.</li>
    </ul>
  </div>

  <h2>Nothing passes through anything</h2>
  <div class="col">
    <p>A new check builds each shot in Blender, steps through it, and tests whether any part of her goes inside her own head, the other arm, the doll, the table, the stool or the chair. It found and helped fix a lot that the eye would miss:</p>
    <ul class="what">
      <li><b>On the needle:</b> her fingers in the doll's button eye (she now holds the needle by its back), and her hand passing into her own head on the pull (it now draws out to the side).</li>
      <li><b>Her arms:</b> a forearm through the doll's head, and hands inside the table when they rested at the knitting pose.</li>
      <li><b>Her body:</b> hips sunk into the stool and the chair, so seats now sit exactly under her.</li>
      <li><b>The doll:</b> it sat 1.5 cm into the table, and its feet went into it too. Both were already wrong in the old version.</li>
      <li><b>Lifting:</b> her elbows went through the table edge, and the doll rose into her face.</li>
      <li><b>Leaving:</b> as she went down into the pit, her skirt passed through its wall. She now goes down inside the mouth.</li>
    </ul>
    <p style="margin-top:14px">What remains is fingertips and a thumb pressing into the doll's knitted body as she grips it, which is what a hand on soft yarn does.</p>
    <p style="margin-top:16px">Not checked:</p>
    <ul class="what open">
      <li>How the motion feels at full speed. I checked sampled frames, and stills can't show timing. Each move is a few numbers in <code>shots.py</code> if anything looks off.</li>
    </ul>
    <div class="files">
      <div><b><code>scripts/cine/lib.py</code></b><span>The new knitter, hands and finger poses, the arm solver, knitting needles.</span></div>
      <div><b><code>scripts/cine/shots.py</code></b><span>Sewing, lifting, knitting, lantern and thread done by her hands; review stills K1–K3.</span></div>
      <div><b><code>scripts/cine/clipcheck.py</code></b><span>The check for things passing through each other.</span></div>
      <div><b><code>scripts/cine/sets.py</code></b><span>Seats at her height; the doll on the table, not in it.</span></div>
    </div>
  </div>
'''
print(page('knitter', 'Spindledeep · Her Own Two Hands', body, PREV))
