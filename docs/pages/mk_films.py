"""Build change page 5 (the films). Stills come from the prologue only; the epilogue stays unseen on purpose."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mkpage import page, hero  # noqa: E402

STILLS = [  # (file, caption)
    ('p1.jpg', 'The Brink in a blizzard: one window lit at the edge of the pit'),
    ('p2.jpg', 'Through the glass, her silhouette bent over her work'),
    ('p3.jpg', 'The last red stitch, by candlelight'),
    ('p4.jpg', 'The flame leans toward the window'),
    ('p5.jpg', 'A loop of red thread drawn tight'),
    ('p6.jpg', 'The door opens on the storm'),
    ('p7.jpg', 'Her lantern crossing the snow to the lip'),
    ('p8.jpg', 'The doll on the sill, alone'),
    ('p9.jpg', 'Its hand closes on the thread'),
]


def build(extra_links, runtime_intro, runtime_outro, size_mb):
    grid = '\n'.join(f'      <figure><img src="img/{f}" alt="{c}"><figcaption>{c}</figcaption></figure>' for f, c in STILLS)
    body = hero('change 5 of 5', 'Two Films', 'A prologue before the first step', 'and an epilogue after the last') + f'''
  <style>
    .stills {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 8px 0 22px; }}
    .stills figure {{ margin: 0; display: grid; gap: 6px; min-width: 0; }}
    .stills img {{ width: 100%; display: block; border: 1px solid var(--rule); background: var(--ink-2); }}
    .stills figcaption {{ font-family: var(--fell); font-style: italic; font-size: 14px; color: var(--paper-dim); line-height: 1.35; }}
    .sealed {{ border: 1px solid var(--rule); background: var(--ink-2); padding: 28px 22px; text-align: center; display: grid; gap: 10px; margin: 8px 0 22px; }}
    .sealed .seal {{ width: 46px; height: 46px; margin: 0 auto; border-radius: 50%; border: 1px solid var(--red); box-shadow: 0 0 14px rgba(216,38,44,0.45), inset 0 0 10px rgba(216,38,44,0.35); display: grid; place-items: center; font-family: var(--display); color: var(--red); font-size: 22px; }}
    .sealed p {{ margin: 0; font-family: var(--fell); font-style: italic; color: var(--paper-dim); }}
    @media (max-width: 640px) {{ .stills {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }} }}
  </style>

  <div class="col summary">
    <p>The game now opens with a prologue film and closes with an epilogue film. Both are full 3D scenes built and rendered offline in Blender, then engraved frame by frame with the same line work, ink and paper as the game, so they cut straight into play without changing style.</p>
    <p>The prologue runs {runtime_intro}. The epilogue runs {runtime_outro}. Together they add about {size_mb} MB to the game.</p>
  </div>

  <h2>The prologue</h2>
  <p class="ask">Add cinematic cutscenes to the beginning and the ending of the game. They can be full 3D, rendered offline for the best quality. Be a real cinematographer.</p>
  <div class="col">
    <p>The prologue plays when you choose <b>Begin</b>. It has no dialogue: her voice belongs to the memories you find on the way down, so the film shows the night she left and leaves the telling to the game.</p>
  </div>
  <div class="stills">
{grid}
  </div>
  <div class="col">
    <ul class="what">
      <li><b>The shape of it.</b> It opens wide and far away and closes in: the storm, then the window, then her hands, then the doll's face. Then it pushes back out into the cold with her and ends close on the doll again, alone. The last shot is the doll's hand closing on the thread, and the next thing you do in the game is hold that thread.</li>
      <li><b>Light tells the story.</b> The warm window is the only colour in the storm. Inside, the candle and the hearth throw her shadow big across the wall. When the door opens, the candle dies, and from then on the room is lit only by the cold from outside.</li>
      <li><b>Her face is never shown.</b> We see her as a silhouette, a shadow, a shape with a lantern. She stays a presence you're going after, not a character you've met.</li>
      <li><b>Lenses and movement.</b> Wide lenses for the storm, long lenses with a shallow focus for the table, and a little hand-held drift in every camera so nothing feels mechanical. Dissolves only where time passes; everywhere else it cuts.</li>
      <li><b>Sound.</b> The storm is loud outside and muffled through the walls inside. You hear the candle crackling, the thread pulling through, the loop tightening, the door. Under the doll on the sill, the open door bangs once. It is all mixed from the game's own recordings.</li>
    </ul>
  </div>

  <h2>The epilogue</h2>
  <div class="col">
    <div class="sealed"><div class="seal">&#x2766;</div><p>You said you don't know the ending yet and didn't want it spoiled, so nothing from the epilogue is on this page.</p></div>
    <p>It plays after the final scene in the Loom, right before the credits. It's made the same way as the prologue and runs a little shorter.</p>
  </div>

  <h2>How the films are made</h2>
  <div class="col">
    <ul class="what">
      <li><b>Built in code.</b> Every set, prop, light and camera move is a Python script for Blender 4.2: the cottage log by log, the woodpile dropped log by log like the one in the game, the doll with its button eye, ribbon and patch, the knitter, the spinning wheel, the pit. Snow is thousands of wind-driven streaks recomputed every frame.</li>
      <li><b>Rendered as data, not pictures.</b> Each frame comes out of Blender as lighting, depth, surface direction, world position and a mask for the red thread, the snow and the warm lamps.</li>
      <li><b>Engraved afterwards.</b> A GPU pass turns those into the game's intaglio plate using the same maths as the game's shader. The difference is that the lines are fixed to the surfaces in the world rather than to the screen, so they stay on the walls and the snow as the camera moves. Line spacing follows how each surface faces the camera, so it stays even on foreshortened ground. The lines re-engrave six times a second, as the game's do.</li>
      <li><b>Cut and mixed by script.</b> A last script joins the shots with cuts and dissolves, adds the engraved title card, lays the soundtrack and encodes for the game.</li>
    </ul>
  </div>

  <h2>In the game</h2>
  <div class="col">
    <ul class="what">
      <li><b>Begin</b> plays the prologue, then starts the game at the cottage. <b>Continue</b> skips it.</li>
      <li>The epilogue plays after the final scene, then the credits roll as before.</li>
      <li>Hold any action key or button for about a second to skip a film. A thin red bar fills up while you hold.</li>
      <li>The game's own sound is muted while a film plays and comes back after.</li>
    </ul>
    <p style="margin-top:16px">Where it is:</p>
    <ul class="what">
      <li>The films are <code>app/assets/cine/intro.webm</code> and <code>outro.webm</code>. Everything that makes them is in <code>scripts/cine/</code>, and <code>CLAUDE.md</code> explains how to re-render a shot.</li>
    </ul>
  </div>

'''
    return page('films', 'Spindledeep Films', body, extra_links)


if __name__ == '__main__':
    print(build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]))
