import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero, reveal


def build(d):
    body = hero('the bitten ending, the shelf', 'Let Go', 'the thread falls away', 'and her things come down')
    body += '''
  <div class="col summary">
    <p>Thirteen changes from one message. The bitten ending plays out properly in the game now: the thread drops off the doll, she walks to the candle and sits down, the thing blows the candle out where it stands, and its neck meets its head without a gap. No piece of thread is left glowing on black between screens, and the end cards and credits skip when held. Her shelf is now the shelf itself, close up: you take a keepsake down and put it back. The last film is softer, and the film of the bitten ending stops before the chairs.</p>
  </div>
  <p class="ask">when I cut it it should actually fall off the doll, not just become grey. When doll is walking to the candle, the legs are moving to slow, it is flowing over the ground. Make it walk to the candle and sit down. [&hellip;]</p>

  <h2>The thread lets go</h2>
  <div class="col">
''' + reveal('bite', 'bite_b.jpg', 'bite_a.jpg', 'Before: the grey thread still runs into the doll', 'After: it has come away from her and lies on the floor') + '''
    <p class="reveal-cap">Two seconds after the bite</p>
    <ul class="what">
      <li><b>It comes away from her.</b> Before, the thread was always drawn from her hand, and the stretch since the last pole was pinned to her every frame, so biting only turned it grey. Now the bitten end is unpinned. Nothing more is paid out, it is drawn with a gap at her hand, and the stretch since the last pole falls under its own weight and settles on the rock. It is still tied at the pole.</li>
      <li><b>Then the red goes out of it</b>, from the bitten end back, once it has fallen. A soft sound of yarn landing goes with the drop.</li>
    </ul>
  </div>

  <h2>She walks, and sits</h2>
  <div class="col">
''' + reveal('sit', 'sit_b.jpg', 'sit_a.jpg', 'Before: she stands by the candle', 'After: she sits down beside it') + '''
    <ul class="what">
      <li><b>Why she slid.</b> The ending set her speed directly, while her legs were driven by input that was empty; friction ate most of the speed every frame, and the legs and the ground never agreed. Now the ending holds a stick for her the way the walk out of the cottage does, so she walks on her own legs at a walk (about 1.2 m/s), slows over the last metre and stops by the candle.</li>
      <li><b>Then she sits</b> beside it, facing it, the same way she sits at the seats in the game, with a little sound of cloth.</li>
    </ul>
  </div>

  <h2>The candle</h2>
  <div class="col">
''' + reveal('blow', 'blow_b.jpg', 'blow_a.jpg', 'Before: the head faces away from the candle when it blows', 'After: it has come down beside the flame and turned its face to it') + '''
    <p>Before, the head kept facing the doll while the flame went out a metre away. Now, for the blow, it comes down beside the candle, turns its face to the flame, and blows on it, and then the light goes.</p>
  </div>

  <h2>Neck and head</h2>
  <div class="col">
''' + reveal('neck', 'neck_b.jpg', 'neck_a.jpg', 'Before: a dark gap at the seam under the jaw', 'After: the neck meets the head closed all round') + '''
    <p>The neck is a chain of joints laid along a curve, and each joint used to turn with the curve. The head turns to where it looks. Where those two disagreed (a neck coming in from the side), the last ring of the neck stood tilted against the head and the seam opened dark on one side. The last part of the neck now eases round to the head's own angle, so the ring meets the head square. This applies everywhere the long neck is used, the climb included.</p>
  </div>

  <h2>Her lines</h2>
  <div class="col">
    <p class="ask">The monster should not repeat "What have you done" multiple times, one is okay, but there should be other lines.</p>
    <p>It said that line three times: once, again slowed down a moment later, and once more as it fell. Now it says it once, and two new lines take the other places. Both were recorded in her voice the same way as all of hers (cast reference, design and clone takes, chosen by words, likeness, age and pace) with the second, lower voice under them. The bite is a second longer so the second line finishes before it lunges.</p>
    <details class="seal"><summary>Open the two new lines</summary>
      <p>After the bite, low and cold: <i>&ldquo;You let go. You were never to let go.&rdquo;</i> (the one rule in her first note, turned round).<br>Falling down the well: <i>&ldquo;Hold on to me!&rdquo;</i></p>
    </details>
  </div>

  <h2>Nothing on black</h2>
  <div class="col">
    <p class="ask">make sure that between cutscenes, titles and etc I don't see just a piece of rope</p>
''' + reveal('rope', 'rope_b.jpg', 'rope_a.jpg', 'Before: red and grey thread across a black screen after the credits', 'After: black') + '''
    <p class="reveal-cap">The moment between the credits and the last film, brightened three times so it can be seen</p>
    <ul class="what">
      <li><b>Why.</b> The thread is drawn in a pass of its own after the picture. The fade to black covered the picture and not the thread, and the thread was only dimmed in the ending itself, so after the credits, behind a film, and at every other change of screen it stayed lit on black. It now goes out with the picture, wherever the picture fades.</li>
      <li><b>Also:</b> under a film the world is black; and the last line said before a film no longer hangs on as a subtitle through the film, the cards and the credits.</li>
    </ul>
  </div>

  <h2>Hold to skip</h2>
  <div class="col">
    <p>The cards after the film and the credits now skip when a key is held, like the films: the same &ldquo;hold to skip&rdquo; with its red line filling, the same keys, and through black. Held on the cards, they go straight to the credits; held on the credits, they go on to what comes after them. A single press no longer skips the credits by accident.</p>
  </div>

  <h2>The film of the bitten ending</h2>
  <div class="col">
    <p>Its last shot, the chairs and the names, is gone: that belongs to the film after the titles. The film now ends going down the well into the dark; it is 31 seconds instead of 45. Its sound was mixed again without that shot and is still exactly on the picture.</p>
  </div>

  <h2>Her shelf</h2>
  <div class="col">
    <p class="ask">for the collectibles on the shelf - their outline is too thick when they are just in the world, make it thinner. And make "Her shelf" more interactive - it should be an actual close up of the shelf where I can pick (click) an item and it opens full screen. And add some sounds of interactions.</p>
''' + reveal('outline', 'outline_b.jpg', 'outline_a.jpg', 'Before: the keepsakes on the shelf in thick ink', 'After: a hairline round each') + '''
    <p class="reveal-cap">On the shelf by her door, at the game's own distance. Things lying about in the caves get the same thinner line; held up close they keep the doll's</p>
''' + reveal('board', 'board_b.jpg', 'board_a.jpg', 'Before: one keepsake at a time over a dark screen', 'After: the shelf itself, close, the seed packet pointed at') + '''
    <ul class="what">
      <li><b>The shelf, close.</b> &ldquo;Her shelf&rdquo; (from the title, or at her door) now opens on the two boards with everything she has brought home, where she put it. Point at one with the mouse, or step along with left and right: it lifts a little, catches the light and its name comes up.</li>
      <li><b>Take it down.</b> A click (or the act key) and it comes off the shelf and up to you, large, with its words, to be turned with the mouse; left and right go to the next. Click or Esc and it goes back where it was, and the shelf is there again. Esc on the shelf leaves.</li>
      <li><b>Sounds.</b> A small wooden tap when you point at one; wood, cloth and a low bowl when you take one down; cloth as you go through them; a tap and a soft breath when it goes back.</li>
      <li><b>Light.</b> Close up, the window, her own red warmth and her thread washed the boards out pink; while the shelf is open they are turned down, one soft light hangs over the boards and the wall behind goes quiet.</li>
      <li><b>Keys.</b> A key tapped faster than a frame used to be lost; now it counts, here and in play.</li>
    </ul>
    <figure class="still"><img src="img/item_a.jpg" alt="One keepsake taken down, large, with its name and words"><figcaption>Taken down</figcaption></figure>
  </div>

  <h2>The last film, softer</h2>
  <div class="col">
    <p class="ask">the last cinematic has too harsh post processing, make it a bit smoother</p>
''' + reveal('soft', 'soft_b.jpg', 'soft_a.jpg', 'Before: hard-edged lines that stop abruptly', 'After: softer lines that fade into the dark') + '''
    <p>The engraving of that film has a new gentler setting: the lines have softer edges and blend a little into their own tone, and the dark comes on gradually instead of where a line stops. The contrast and darkness stay as they were, and its flicker went down from 2.95 to 1.79.</p>
  </div>

  <h2>Checked</h2>
  <div class="col">
    <div class="tablebox"><table class="windows"><tr><th>Check</th><th>Result</th></tr>
      <tr><td>Whole game, bot, plain</td><td class="n">reaches the choice</td></tr>
      <tr><td>Whole game, bot, frayed</td><td class="n">reaches the choice</td></tr>
      <tr><td>Bitten ending end to end (hidden window)</td><td class="n">no errors</td></tr>
      <tr><td>Bitten film, sound against picture</td><td class="n">0.0 ms</td></tr>
      <tr><td>Last film flicker</td><td class="n">2.95 &rarr; 1.79</td></tr>
    </table></div>
  </div>

  <h2>Where it lives</h2>
  <div class="col"><div class="files">
    <div><b>The ending</b><span><code>app/src/ending.js</code></span></div>
    <div><b>Letting go</b><span><code>app/src/thread.js</code> (<code>letGo</code>)</span></div>
    <div><b>Neck</b><span><code>app/src/figure.js</code> (<code>headTo</code>)</span></div>
    <div><b>Black, skipping, the shelf</b><span><code>app/src/main.js</code>, <code>app/src/shaders.js</code>, <code>app/src/props3d.js</code></span></div>
    <div><b>Lines</b><span><code>scripts/voice/lines.py</code>, <code>app/assets/voice/</code></span></div>
    <div><b>Films</b><span><code>scripts/cine/edit.py</code>, <code>scripts/cine/post.py</code> (<code>--soft</code>)</span></div>
  </div></div>
'''
    style = '''<style>
    details.seal { margin: 18px 0; border: 1px solid var(--rule); padding: 14px 18px; }
    details.seal summary { cursor: pointer; font-family: var(--mono); font-size: 12px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); }
    details.seal summary:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    figure.still { margin: 26px 0; } figure.still img { width: 100%; display: block; border: 1px solid var(--rule); }
    figure.still figcaption { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--paper-dim); margin-top: 8px; }
    .reveal-cap { margin-top: 10px; }
  </style>
'''
    return page('shelf', 'Let Go: the bitten ending, the shelf', style + body, d.get('extra', ''))


if __name__ == '__main__':
    import json
    print(build(json.load(open(sys.argv[1], encoding='utf-8'))))
