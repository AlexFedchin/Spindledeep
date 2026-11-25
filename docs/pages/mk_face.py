"""Changes page: the ending, scene by scene, with the 3D figure (`face/`). Open: the user said (2026-11-25) not to hide how the
ending looks. The clips (`face/vid/`, not in git) are recorded from the game: canvas.captureStream + the game's own output."""
from mkpage import page, hero, reveal

PREV = (' &middot; <a href="https://claude.ai/artifact/J1avXLArMvcKdXb2hRBTGz">what is down there</a>'
        ' &middot; <a href="https://claude.ai/artifact/NZ8LqQVJhCyzqS1shjTGD7">listen</a>')
CSS = '''  <style>
    .clip { margin: 8px 0 26px; }
    .clip video { display: block; width: 100%; height: auto; aspect-ratio: 1280 / 696; border: 1px solid var(--rule); background: var(--ink-2); }
    .clip video:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }
    .clip figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); margin-top: 10px; }
    .said { font-family: var(--fell); font-style: italic; font-size: 19px; color: var(--paper-dim); text-align: center; margin: 4px 0 20px; text-wrap: balance; }
    .wide { max-width: 900px; margin: 0 auto; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''


def clip(n, cap):
    return f'''  <div class="wide"><figure class="clip"><video id="v-{n}" controls playsinline preload="none" poster="img/p_{n}.jpg" src="vid/{n}.mp4"></video><figcaption>{cap}</figcaption></figure></div>
'''


def sc(h, text, said=''):
    s = f'\n  <h2>{h}</h2>\n  <div class="col">\n' + (f'    <p class="said">{said}</p>\n' if said else '')
    return s + ''.join(f'    <p>{t}</p>\n' for t in text) + '  </div>\n'


def rv(i, b, a):
    return '  <div class="wide">\n' + reveal(i, i + '_before.jpg', i + '_after.jpg', b, a).replace('value="50"', 'value="20"') + '  </div>\n'


body = CSS + hero('the ending', 'The Ending', 'She is holding out', 'the end of her thread') + '''
  <p class="ask">You can now not hide how the ending looks, make me a proper artifact</p>
  <div class="col summary">
    <p>Both endings, scene by scene, recorded from the game as it is now. The monster is a 3D figure with a skeleton, posed and lit inside the game. The clips have the game&rsquo;s sound and one loud moment; the subtitles and the choice itself are not in the recordings, so the lines are written out here.</p>
  </div>
''' + sc('On the way up', ['Before the top, in the rising dark, it comes up the far wall after you: three quick steps, then still, with its head turned right round to look. The clip is set up by hand so that it stays in view; in play you are climbing away from it.']) \
    + clip('chase', 'the rising dark &middot; 12 seconds') \
    + sc('The choice', ['The candle, and what is left of the real knitter under her shawl. Past the light, the knitter kneels with the end of the grey thread held out in both hands. It has her voice and her face.',
                        'It is the monster. The longer you stay, the nearer she leans, on a neck that is never quite the length it was. You hold one key to tie your thread to hers, or another to bite your own in two.'],
         '&ldquo;There you are. Oh, little one, you came all this way. I&rsquo;m so cold. Tie your thread to mine, and pull me up. Please. Please.&rdquo;') \
    + clip('choice', 'walking up to her &middot; 24 seconds') \
    + rv('choice', 'Before: the legs of a giant picture of a person', 'Now: the knitter kneels, holding out the thread') \
    + sc('Tied', ['The candle goes out. For a few seconds there is nothing but the doll and the red thread, and in the dark she grows.',
                  'Then a light from nowhere shows her still kneeling, still holding the thread, and a neck that goes up out of sight. The head comes down over the doll a joint at a time, the wrong way up, and turns over when it gets there. It thanks you. One second in which nothing happens. Then it calls.'],
         '&ldquo;Thank you, little one. Now we can all come up.&rdquo;') \
    + clip('tie', 'loud at the end &middot; 24 seconds') \
    + rv('reveal', 'Before: a still picture on all fours', 'Now: the neck arches up and comes down over the doll') \
    + rv('talk', 'Before: a picture of a face', 'Now: her head, speaking') \
    + sc('It climbs out', ['Five places you came through, each seen from a camera that does not move: the Hall of Chairs, the Ink Mere, the Bell Gallery, the Throat, home. The thread lies there. Then it comes along it hand over hand, and every light it passes goes out.',
                           'Each hand and foot takes one place on the thread and holds it while the rest goes by. The arms stretch as far as they must. Once in every place it looks out at you. At the cottage it stops, raises its head, and the window goes dark. The film follows, and that has not changed.']) \
    + clip('climb', 'the whole way up &middot; 44 seconds') \
    + rv('climb', 'Before: arms out of a dark patch', 'Now: a whole body going along the thread') \
    + rv('home', 'Before: arms out of a dark patch by the cottage', 'Now: it arrives at the cottage') \
    + sc('Bitten', ['The red goes out of the thread, from her teeth upward. It asks what you have done, twice, the second time not in her voice. It leans in, and breathes the candle out.'],
         '&ldquo;What have you done?&rdquo;') \
    + clip('bite', 'the thread bitten &middot; 18 seconds') \
    + sc('In the dark', ['Hands on the floor, looking for her. Then half a second of light and no sound: the face beside the doll. It is only listening. The clip is black until then, and black after.'],
         '&ldquo;Little one? That isn&rsquo;t a name. What is your name?&rdquo;') \
    + clip('dark', 'eight seconds of black, then the light &middot; 14 seconds') + '''
  <h2>Fixed while recording</h2>
  <div class="col">
    <ul class="what">
      <li><b>Rags at her throat.</b> Part of her collar was tied to the head, so it stretched into spikes when the neck grew. No point of the body hangs on the head any more.</li>
      <li><b>The Throat.</b> It crossed that place too fast to see. It takes 4.4 seconds now instead of 3.2.</li>
      <li><b>The face in the half second of light</b> was small and turned away. It is larger and turned to you.</li>
    </ul>
  </div>

  <h2>Why it looked like that before</h2>
  <p class="ask">why when I get asked to either bite the thread or tie it there is this weird picture of human climbing? Shouldn't it be our knitter aka the monster pretending to be the knitter? And why when it climbs out it is just a pale gradient with a bunch of hands?</p>
  <div class="col">
    <ul class="what">
      <li><b>The human</b> was one still picture of a person on all fours, twelve metres tall, standing over the place. You were meant to take its limbs for pillars. The camera showed most of it, so it read as someone climbing.</li>
      <li><b>The hands</b> were one picture of an arm, bent nine ways and cut off at the back. The round patch of dark was there to hide the cut ends, and against a dark cave or a light sky you saw the patch itself.</li>
    </ul>
  </div>

  <h2>If you give me a model</h2>
  <p class="ask">Do you think you can make it better if I give you some 3d model so that you don't have to manipulate images?</p>
  <div class="col">
    <p>Yes. This one is younger in close-up than the voice is, and her knitted cap looks modern. Best would be to keep the knitter for the pretending and have a second model for what comes out of her.</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>What</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Rigged: FBX, GLB or .blend</td><td>Arms, legs, spine, neck and head at least. Fingers and a jaw that opens matter most here.</td></tr>
          <tr><td>Up to about 60,000 triangles</td><td>It is drawn live. The present one is 25,000 and the game stays at 60 frames a second.</td></tr>
          <tr><td>A colour texture, and a normal map if there is one</td><td>Only its light and dark is used. Wrinkles, veins and ribs show well in the engraving.</td></tr>
          <tr><td>Animations: not needed</td><td>The movement is made in the game, so it can hold the thread and fit the rock.</td></tr>
          <tr><td>A licence that allows use in a game</td><td>The repository is public, so model files stay out of it and only go into the built game.</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:16px">Still pictures left in the game: the hands in the Hush, the people on the Loom&rsquo;s floor, and the arms in the rising dark. One model of a person would do for the last two.</p>
  </div>

  <h2>Where it lives</h2>
  <div class="col">
    <div class="files">
      <div><b><code>app/src/ending.js</code></b><span>The scenes and their timing.</span></div>
      <div><b><code>app/src/figure.js</code></b><span>Skeleton, limbs, the neck, and the poses.</span></div>
      <div><b><code>app/src/stage.js</code></b><span>Which figure is where and doing what.</span></div>
      <div><b><code>app/src/renderer.js</code> &middot; <code>shaders.js</code></b><span>The figure pass and its engraving.</span></div>
      <div><b><code>scripts/figures/export.py</code></b><span>A rigged model in, the game&rsquo;s format out.</span></div>
    </div>
  </div>
'''
print(page('face', 'Spindledeep · The Ending', body, PREV))
