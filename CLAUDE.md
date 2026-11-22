# Spindledeep — working notes for Claude

Electron 45 + raw WebGPU side-view platformer drawn as an intaglio engraving; a red thread is the
player's tool and nearly the only light. Source is `app/src/`, level data is `app/src/level.js`.

## Change pages (standing rule from the user)

After **every** batch of changes (aka user's message) the user asked for, publish a changes page as an Artifact and give them the link. Also commit and push to main without asking.

- One page per change (or per closely related group of changes made in one go), not one page for a whole session.
- **Visual changes get before/after screenshots in a reveal slider**: the before image underneath,
  the after image on top clipped to the right of a draggable red-thread divider. Take the _before_
  shots before editing anything visual (headless shot harness below).
- Non-visual changes (physics, bugs) get a short explanation and, where it helps, a chart or table
  from the in-page solver instead of screenshots.
- **Keep every page in the same style.** Start from `docs/pages/_template.html` and do not restyle it:
  - single dark look: ink `#0c0b10`, ink-2 `#16141c`, rule `#2c2832`, paper `#e8dcc4`,
    paper-dim `#a99f8c`, thread red `#d8262c`
  - fonts: IM Fell English SC (display), IM Fell English (italic captions), Spectral 300 (body),
    IBM Plex Mono (eyebrows, labels, figcaptions)
  - parts: centred hero (red mono eyebrow, small-caps title, italic tagline split by a glowing red
    rule), `h2` with the knot-and-rule ornament, a "You asked:" line quoting the user, `.reveal`
    sliders, `ul.what` diamond lists, `table.windows`, the `.files` grid for paths, italic footer
    linking the earlier pages
- **Text must read as full-width paragraphs, never a narrow column.** Pages from 2026-11-21 shipped
  with list text wrapped one word per line: `ul.what li` was a CSS grid, so `<li><b>Lead.</b> text</li>`
  became two grid cells and the text fell into the 22 px bullet column. Rules:
  - never put `display: grid`/`flex` on an element whose children mix inline tags and bare text
    (`li`, `p`, captions); the template's `ul.what li` is block flow with an absolute diamond — keep it
  - before publishing, screenshot the page at 1200 px wide (headless Edge:
    `msedge --headless=new --window-size=1200,2600 --screenshot=out.png file:///…/index.html`) and look at
    every list and paragraph; text lines should span the ~680 px column
- Screenshots go in the page's `img/` folder as ~1200 px wide JPGs and are published with `files`.
- Earlier pages: original write-up https://claude.ai/artifact/X7CAu6EX2KnXzAq5mpNZbz,
  polish pass https://claude.ai/artifact/75LuG1uAroYU4dzHWNbkHc. Add each new link to
  `docs/pages/INDEX.md`.

## Testing headlessly

**Standing rule from the user: every test run must be unnoticeable on their PC.** No audio, no windows popping up
or stealing focus, no taskbar entries, nothing played or opened for them to see.
- `--smoke` runs are built for this (`electron/main.js`): the window is fully transparent (`setOpacity(0)`),
  click-through, shown with `showInactive()` (never activated), not focusable, off the taskbar, and muted
  (`setAudioMuted`). It must be *shown*: a never-shown window pauses requestAnimationFrame, so screenshots still
  render but the game loop does not run (deaths, timers, saves silently never happen). Occlusion/background
  throttling switches are off in smoke mode. Never remove those, and never launch the game without `--smoke` for a test.
- Test runs use their own profile (`%TEMP%/spindledeep-smoke`, set in `electron/main.js`), so they never touch the
  player's save. `__SD.cont()` continues from the save like the title's Continue.
- Real input for tests: a shots step can take `click: '<css selector>'` and `keys: ['Enter', 'Space', ...]`
  (`sendInputEvent`, so focus and default actions behave like a real player's). Session logs land in
  `<profile>/logs/session-*.log` (player: `%APPDATA%\Spindledeep\logs`); read them first when the user reports a bug.
- Overlays hide with opacity, so `show()` in main.js also sets `inert`: never hide UI with opacity alone (a focused
  hidden menu button once restarted the game whenever Enter/Space was pressed in play).
- When comparing against the old build, stash only `app/src` (`git stash push -- app/src`), never the whole tree:
  stashing `electron/main.js` brings back a visible window.
- Page screenshots: headless Edge only (`--headless=new`). Never open pages, images, videos or audio in a viewer/player
  to check them; read images with the Read tool and probe media with ffprobe/ffmpeg to files.
- Blender, ffmpeg, Python, TTS: background/CLI only (`blender -b`), no previews, no playback, no `start`/`explorer`.

- `unset ELECTRON_RUN_AS_NODE; node_modules/electron/dist/electron.exe . --smoke=out.png --shots=list.json`
  where the list is `[{js, wait, out, log}]`. `window.__SD` exposes `begin()`, `go(x,y)`, `W` (world),
  `cam`, `SWING` (live swing tuning).
- Swing/level feasibility: drive `new __SD.W.constructor(__SD.W.T)` synchronously with fake input
  (see `docs/pages/INDEX.md` for what was verified). Any change to swing physics or ring/platform
  positions must be re-verified for all 12 ring gaps.
- Python here defaults to cp1251: run edit scripts with `PYTHONUTF8=1` or pass `encoding='utf-8'`.

## Story (spoilers in docs/STORY.md)

The plot was rewritten on 2026-11-22 to the user's brief: not straightforward, dark, ominous, unexpected, and darker
the deeper you go. The user asked **not to be spoiled**: never put plot content in chat summaries or in the open part
of a changes page; describe structure only and put the plot behind a sealed `<details>` block. Any new line, keepsake
or prop must fit the escalation map in `docs/STORY.md` (nothing at a shallower depth may be grimmer than what's below).

## Hidden rooms

`level.js` `SECRETS`: each has a `hide` rect drawn as rock (visual SDF only) until the room is entered; keep that rect off
main-cave air or the real cave gets painted over. Narrow cracks need a `QUIET` rect or erosion can seal them. Rooms must be
walkable both ways (no side-view switchbacks: a hairpin always leaves a ledge taller than the 1.87 m jump).

## Cinematics (scripts/cine)

Offline-rendered films: `app/assets/cine/intro.mp4` (prologue, plays on Begin) and `outro.mp4`
(epilogue, plays after the ending, before the credits). The user asked not to be told what the ending
film shows; keep its content out of pages and summaries.

- Blender 4.2.3 portable lives in `scripts/cine/.cache/blender-4.2.3-windows-x64/` (ignored by git).
- `lib.py` (materials, doll, knitter, snow, threads), `sets.py` (exterior, interior, Loom, shaft),
  `shots.py` (one function per shot, `INTRO`/`OUTRO` lists, per-shot post exposure).
- Render: `blender -b -P scripts/cine/render.py -- <shot> [--preview] [--still=F]` writes 16-bit PNG
  passes (sqrt beauty, normal, encoded world position, aux masks, log depth) to `.cache/frames/<shot>`.
- Grade: `<art venv>/python scripts/cine/post.py <frames> <out> --exposure=E` turns passes into the
  game's engraving (same ink/paper/line maths as `app/src/shaders.js`; lines anchored in world space).
- Edit: `<art venv>/python scripts/cine/edit.py intro|outro` cuts, adds title/fade, mixes the soundtrack
  from `app/assets/audio`, encodes H.264/AAC (VP9 1080p fails to decode in Electron here). `preview_all.sh` renders half-res stills of every shot.
- Checking films for faults: `scratchpad flick.py`-style back-and-forth metric (|b-a|+|c-b|-|c-a| per pixel) finds
  flicker; snow scores high legitimately, so look at consecutive frames. Faults found 2026-11-22: lines boiling on
  surfaces outside a shot's `pos_lo/pos_size` box (clamped position pass, now engraved as sky in post.py) and on
  surfaces where one line family has ~zero gradient (now forced to the other family); threads built as straight
  catenaries through furniture (route them over real surfaces, see `_sill_thread`); props placed inside the log
  walls (front logs bulge to y = -0.17). Re-render only the touched shots, but re-grade all after a post.py change.
- The knitter (`lib.knitter`, rebuilt 2026-11-22): lofted body + cardigan, face, glasses, bun, shawl, skirt; arms are
  `arm*` (keyable offset, rest 0) → `sh*` → `fore*` → `hand*` with jointed fingers. Pose hands with `lib.hand_pose`
  ('relax'/'hold'/'grip'/'pinch') and place them with `lib.arm_to(P, side, world_target, pole=, offset=, palm=)` (two-bone
  IK; per frame from a FRAME_FN when the figure itself is static, see I3/I5). `lib.pinch_offset` gives the thumb-index
  point. Seated hips are at 0.5, so seats are 0.48 high. Never key `arm*` with large values on the new rig.
- Clipping check: `blender -b -P scripts/cine/clipcheck.py -- <shot> [frames]` builds the shot and BVH-tests her arms,
  head and body against each other, the doll and the furniture. Run it on every shot she appears in after changes;
  fingertip contact on the soft doll is fine, palms/cuffs/forearms/heads through things are not.
- Review stills K1/K2/K3 in shots.py (not in either film) show the model: `render.py -- K2 --preview --still=1`.
- EEVEE Next gotchas: a world volume swallows the sun (use `lib.fog_box`); compositor colour inputs clamp
  negatives (offsets go through math nodes).

## Builds

`build.cmd` writes `release/Spindledeep-1.0.0-portable.exe` and `-setup.exe`.
