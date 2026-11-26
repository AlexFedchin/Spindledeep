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
  `<profile>/logs/session-*.log` (player: `%APPDATA%\Spindledeep\logs`); read them first when the user reports a bug (they also say what the user has and has not found).
- Overlays hide with opacity, so `show()` in main.js also sets `inert`: never hide UI with opacity alone (a focused
  hidden menu button once restarted the game whenever Enter/Space was pressed in play).
- When comparing against the old build, stash only `app/src` (`git stash push -- app/src`), never the whole tree:
  stashing `electron/main.js` brings back a visible window.
- **On Linux (Wayland GNOME)** the transparent smoke window is not guaranteed to stay hidden: add `--ozone-platform=headless` to every electron run
  (`node_modules/electron/dist/electron . --ozone-platform=headless --smoke=… --shots=…`); WebGPU renders and nothing reaches the desktop. Node 24 has no
  `--experimental-default-type`: run the checks as plain `node scripts/checks/x.mjs`. Page screenshots: `google-chrome --headless=new --mute-audio`.
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
the deeper you go. On 2026-11-25 the user lifted this for **how the game's two endings look** (pages and chat may show them openly); the
ending film and the rest of the plot stay as below. The user asked **not to be spoiled**: never put plot content in chat summaries or in the open part
of a changes page; describe structure only and put the plot behind a sealed `<details>` block. Any new line, keepsake
or prop must fit the escalation map in `docs/STORY.md` (nothing at a shallower depth may be grimmer than what's below).

## Voice (scripts/voice)

The knitter's lines: `lines.py` (script, delivery notes, `PERSONAS`, `WRONG` lines with a lower second voice, `OTHER`/`PLAIN` the child, `ECHO`, `CHORUS`). The user
wants her to sound old. Pipeline (Qwen venv, see memory): `cast.py` (VoiceDesign candidates scored by `age.py`: pitch,
jitter, breathiness, tremor; I can't listen, these stand in) → `.cache/cast/ref.wav`; `record.py` (design + clone
takes) → `pick.py` (words, likeness to ref, age, pace; light ageing fx) → `app/assets/voice/`. The first, younger
recording is kept in `app/assets/voice_young/` (+ `.cache/raw_young`); switch with `VOICE_SET` at the top of
`app/src/audio.js`. Keep both sets when re-recording.

## Hidden rooms

`level.js` `SECRETS`: each has a `hide` rect drawn as rock (visual SDF only) until the room is entered; keep that rect off
main-cave air or the real cave gets painted over. Narrow cracks need a `QUIET` rect or erosion can seal them. Rooms must be
walkable both ways (no side-view switchbacks: a hairpin always leaves a ledge taller than the 1.87 m jump).

A room opens only when her body pushes into its drawn rock (`faceD` in world.js, the same box and grain as terrain.js `_drawn`; the user asked
that it never open sooner), and only from air reachable from the room (`mouthZone`, `at` per room); keep zones off poles and the main way. Every `SECRETS.kind` needs a `KEEP` drawing in props.js.

`SHELVES` (level.js) are the upper ways to two places no jump reaches (Root Gardens alcove, the Last Basket): rises under 1.45 m, gaps under
2.5; drawn by `drawshelf.js`; floor searches (chairs, lore) must not land on them. `LEVEL` planes ledges flat where a jump is made. New poles go
at the **end** of `PEGS` (indices are used in code). After touching the level or `player.js`: `scripts/checks` (lip, gal, reach, shelfrun, fuzz, hands).

Nothing may be drawn inside solid rock by accident: after adding props, machines or foreground, run `scripts/checks/inside.js` as a `--shots` step
(lists every layer's spots in rock). `buildLore` looks for the floor from the hint itself, never from above it (a room's roof). Things in the
rock on purpose are in `buried.js`: sprite layer, drawn blue, engraved into the rock by ENGRAVE (lit and fading as rock does). Beasts only above
the Hush, people only from the Hush down.

## Keepsakes and skeins (2026-11-25)

**The user wants everything 2D; found things are 2-2.5D, never realistic models.** The shapes are models, but `PROP_WGSL` draws them flat: one grey, three steps of
light, ink where print or relief is (high-pass of the baked maps), red only for the thread; ENGRAVE hatches them like the doll and inks their outline. They rock a
little, never turn round (`HOLD`: `blur` = how much surface is left out, `flat` for paper). (`props3d.js`, `_prop` in renderer.js).
`scripts/props3d`: `maps.py` (prints, writing, relief; art venv) → `build.py` (Blender, `-- <names|all> [--draft]`: solids baked to one atlas with
object-space normals, yarn as untextured tubes, plies spun in the shader) → `pack.py` → `app/assets/props/<kind>.bin/.webp/_n.jpg` (ours, in git).
How each is held up: `HOLD` in props3d.js. A new keepsake needs an `item_<kind>` in build.py, a `HOLD` entry and, as a stand-in, a `KEEP` drawing.
Faces must wind outward (bakes of inside-out faces come out black): see `flip` in `lathe`, `outward`. Nothing may glow over a held thing (emission washes it out).

## The chase and the whole-game bot (2026-11-25)

`npm run play [plain|frayed] [seed]` (`scripts/checks/play.mjs`; `FROM=pole`, `V=1`, `TRIES=n`) plays cottage to choice in one world: **run it, both modes, after any
change to level, physics or machines** (it found a gate id used twice, which no room test could). Gate ids must be unique.
Loom: `RISE.legs` (speed and lag per pole), `RISE.surge`; `CRAWL` in deep.js: the thing follows `thread.poly` (kept from her hand backward: `alongThread`). Gates with `give` are
cloth strips. Climb poles: 24 25 26 44 45 46 47 48 27 28. Ring bots must hold grip in the frame they jump off (else no lift).
Keepsakes: 11. Voices m11-m13 stand at the end of MEMORIES (saves index it). `scripts/audio_rooms.py` synthesises the rooms' one-shots. `LIFE` per room: `roomAt` in sound.js.
Builds: `build.cmd` bumps the patch version. Trailer: `scripts/trailer/capture.py` → smoke run → `cut.py`.

## The thread's machinery and the six rooms (2026-11-25)

`rig.js` (rules), `drawrig.js`, `drawrooms.js` (furniture), data in `level.js`: hooks with `sink` (goes down under her, lifts a `rig` gate) or `pull` (wound in
from the ground, stays), `SPINDLES` (turn while the thread runs past), `BOBBINS` (roll over the thread and everything else; the user asked 2026-11-26 that they never stop over her: lie in a gutter and let one pass). Rooms: mat in the Hall's hole → Weighing Room → Pews → H1;
H1 → Slabs → Pin Walk → rope → H2; well ledge → bobbin's lane → lower room → the Loom's well. `LEVEL` planes their floors. Gate 0 and 1 must stay g2 and east.
Check: `scripts/checks/rooms.mjs [frayed]` (`ONLY=name`, `TRACE=1`, `HANDS=1`). Beds of pins at floor level need the ring ~3.6 m up.
Hands: `deaf` ones strike where she was heading (she stopped). They need open air to her to stir or seize, and the arm stops at rock (`_sees`, `_free`); scratchpad-style check: count arm frames inside rock. Pluck is `;` by default (F, J, C too). Frayed mode (`World.mode`): yarn x0.8 but never under 91 (the fall into the Loom).
Options in `options.js` (kept in settings.json with `found`, `ended`, `best`); key bindings in input.js. Saves are v3; older ones in the deep get their thread re-laid.
`--size=WxH` with `--smoke` tests another window shape.

## Sound (app/src/sound.js)

`Sound` feels out the cave at 10 Hz (size, walls, roof, drop) and drives audio.js: four reverbs (`setSpace`), wall echoes, muffling
(`setFilters`, occlusion per sound), ground under her feet (`ground`, `GROUND`), pebbles over edges, answers to a pluck, placed
loops (`_sources` → `A.source`), and what happens on its own per area (`LIFE`). Variants: `GROUPS` in audio.js, `A.any(group)`.
New files come from the `detail_*` recipes; after adding sources run the prune (ids not in build_audio.py out of the cache's
meta.json) before `credits()`. Never use rope/creak-like recordings for anything here, and nothing that drones near the player.
The finale (Loom floor, climb, top) keeps its own silence: `_life` skips it.

## Cinematics (scripts/cine)

Offline-rendered films: `app/assets/cine/intro.mp4` (prologue, plays on Begin) and `outro.mp4`
(epilogue of the 'tie' ending; Blender shots again since 2026-11-25; `plates.py` and E2–E7 in shots.py are retired). The user asked not to be told what the ending
film shows; keep its content out of pages and summaries.

- `cut.mp4`: the film of the bitten ending. Both endings' shots are in `shots_end.py` (below); `shots_cut.py` keeps only the meadow and snow helpers.
  `# auto=` on a shot's decorator fixes its exposure, since post.py otherwise takes it from the first frame. Run the flicker metric on the
  finished mp4: it catches whole seconds that stills at round frames miss.
- Blender 4.2.3 portable lives in `scripts/cine/.cache/blender-4.2.3-windows-x64/` (ignored by git).
- `lib.py` (materials, doll, knitter, snow, threads), `sets.py` (exterior, interior, Loom, shaft),
  `shots.py` (the retired epilogue, review stills, `INTRO`/`OUTRO` lists), `shots_intro.py` (the prologue).
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

## The prologue, second staging (2026-11-25)

Shots are in `shots_intro.py` (I1 I2 I2K I3 I4 I5 I5S I6 I7 I8 I9), render with `render_intro.sh`, stills with `pv.sh SHOT f,f,f`. Rules from the user:
hands touch what they hold (never inside, never hovering) and the doll moves with them; she walks; **every camera move is linear** (`camera()`: no easing, no
hand-held drift); every sound is exactly on its movement; no magic sounds (no harp/chimes) anywhere in it.
- `act.py`: `Hand.grasp/close/pinch/rod_grip` fit her own skin to a distance field (fingers closed joint by joint), `Hold` bolts the hand to the thing,
  `Actor.arm` places a hand exactly (world matrix), `Walk` plants footsteps. Check with `touch.py -- <shot> 1` (gap in mm per hold, arm too short, wrists, feet).
- Sounds: shots call `ev(frame, kind, ...)`, `render.py` writes `events.json`, `foley.py` makes each kind (contact moment `t0` found in the recording),
  `edit.py intro` mixes, `synccheck.py` measures the film. Change a movement's timing and its `ev` together: both use the same variables.
- `post.py`: line fields are tied to one axis per shot (they swept when the camera panned); position pass is written from `lib.ORIGIN` (near the subject: EEVEE keeps
  it in half floats) plus a fine pass `posf`. Moving things carry their lines (`lib.stick`, `restp` on the knitter). Outdoors move the camera sideways: pushing toward
  the snow strobes. Snow strokes must be as long as a frame's flight (`streak` 0.04).

## The endings, second staging (2026-11-25)

`shots_end.py`: C1-C5 (cut.mp4), O1-O7 (outro.mp4), under the prologue's rules (contact, linear cameras, sounds written by the movement). Same tools:
`render_intro.sh SHOTS`, `pv.sh`, `touch.py`, `edit.py cut|outro`, `synccheck.py cut|outro`. Parts to reuse: `Melt` (one melt map drives the snow's material and
the grass), `RoofSnow` (sheet + lumps by numpy), `Vine`, `PetalFall`, `Rocker` (rolls on its runners), `Face`/`voice_env` (jaw from the recording), `Walkers`
(a crowd, steps planted; `steps()` gives the frames feet land on for `ev`), `board_shutters`. `post.py` `BLACK`: where no light falls no line is drawn, so nothing
in the dark is outlined. A shot looked at only in stills hides faults: make a contact sheet of the full render (`tile`), then flick.py.

`names.mp4` (N1) plays after the titles of the bitten ending (`coda` in main.js; the names' frames stand in `NAMES_AT` there and in `SAY` in the shot: change both). `outro.mp4`
opens with O2 (hands at the pit's lip), because the game's climb now ends under that lip (ending.js, last of `places`, then black). `Crawler`: the figure on all fours over any
surface; its arms are 0.44 m, so keep the stride and height or check the reach again (0 to 2 mm short now). Pull-backs strobe above about 0.3 % of the distance per frame.
Lamps inside a fog box need `volume_factor = 0` or they glow.

## The knitter model (2026-11-23)

The user's rigged "Old Lady" (Auto-Rig Pro FBX) lives in `../old-lady-fbx/` (not in the repo; `oldlady.py` also looks in
`scripts/cine/.cache/old_lady/`). `lib.knitter` builds her via `oldlady.build`: the old control skeleton (empties) is built
at her joints and each deforming bone follows a helper under its control (Copy Transforms), so `arm_to`/`hand_pose`/shot keys
work unchanged. Her right hand is anatomical: values written for the old figure's s = -1 hand go through `lib.hand_local`.
`USE_MODEL = False` in lib.py brings back the hand-built figure. She is in the prologue and, since 2026-11-25 (the user: it
should be the knitter, the monster pretending to be her), she is the shape the thing wears in the game's ending. The film after it still has no
old-lady model. `clipcheck.py` splits her meshes by bone weight.

## The deep and the end (2026-11-24)

Below the Ink Mere: Hall of Chairs → the Hush → the Treadles → the Loom (world h 604). Rules in `app/src/deep.js` (swinging
rings, ropes, hands `HAND`, stampers, the called, the rising dark `RISE`, the crawler), drawing in `drawdeep.js`, `drawend.js` and `stage.js` (the thing itself),
data in `level.js`. The ending is `app/src/ending.js` (approach, the held choice, two timelines, `CARDS`); test with
`__SD.end().choose('tie'|'cut')` at peg 28 and set `__SD.end().t` to jump (bitten: parts bite/dies/well/ask, `.startWell()`, `.s`). Nothing may visibly change size in the dark. Sprites: `scripts/art/caller.py` (SDXL) →
`facework.py` (the face) → `cutout.py` → `app/assets/art/sprites/`.
Route checks (now in `scripts/checks`) run in plain node: `node --experimental-default-type=module` can import `app/src` (`buildTerrain`, `World`), far
faster than the Electron harness; scratchpad `run.mjs` runs `route2.js`, `gaps.js`, `mere.js`; `hands.mjs` (bots crossing the Hush),
`fuzz.mjs` (thread inside rock). Any change to the deep's geometry or timing must be re-run through them.
Teleport tests must re-tie the thread at a nearby peg first, or the overstretched thread pulls the doll back.

Rules from the user: no brass anywhere ("Peaceful Desolation" is banned); no thread/rope sound that keeps playing (never play
`creak` whole: 28 s; use `dur`); hands sound like earth; the thread must never pass through rock.

## 3D figures (2026-11-25)

The user finds a monster made of still pictures cringe: the thing is a skinned 3D model drawn live. `scripts/figures/export.py`
(`blender -b -P`) turns a rigged FBX into `app/assets/figures/<name>.bin/.jpg/_n.jpg` (git-ignored: the repo is public and the model is not
ours to hand out; without the files the figures are just absent). `figure.js`: joints, two-bone limbs that stretch, a neck of
any length, poses (`poseKneel`, `poseClimb`, `poseReach`), no baked clips. `stage.js`: which figure is where, from `W.thing`, `W.climber`,
`deep.crawler`. Renderer: `_figures` pass (4x MSAA, lit per pixel by the game's lights, a light's optional `z` = nearer the viewer), engraved in
ENGRAVE (figTex/figNrm), hidden by rock. A new model: an entry in export.py's MODELS (its bone names), then `STAGE.load(name)`.
Still pictures left: the hands in the Hush, the called, the arms in the rising dark. Any monster the user supplies goes through this.

## The thread and rock

`app/src/route.js`: `depthAlong`/`clearLine`, `route` (A* on the SDF + pull taut), `hug` (lay a drawn span along the rock face).
thread.js keeps particles and spans out on every solver pass (a particle inside rock goes back out the way it came in, `_back`; a span that cuts in goes back
to its side of the frame before; speed capped at `VMAX`; snapping both ends back to `lx/ly` is the last resort and should not fire), `grip` string-pulls the thread's own path into
pivots, `wrap`/`snag` bend round corners via `_corners`, `tie` lays the last bit, `buildPoly` hugs what is drawn (fixed part cached
in `_fix`). The grey thread is hugged in `buildGrey`. The live/taut thread is hugged out to `RAD` (where its particles rest), the tied part to `FACE`: hugging the
moving thread nearer than its particles made corners pop between chord and curve. Shake check (2026-11-26, scratchpad-style): random players, a drawn point
that goes out >3 cm and comes back next frame; staged runs at pole 1's lip and up the Root Gardens slabs. Check: `fuzz.mjs` (31.4 % of frames had thread >6 cm inside rock, now 0.2 %).

## Rock, lines and the dark (2026-11-25)

`terrain.js` never goes through a yes/no grid: level shapes as a continuous field, `redistance` (distance to the marching-squares line), noise,
LEVEL planes, `wear` (rounds corners; more passes cost landing lips: re-run gal/lip/play), `redistance`. The GPU texture is rg16float: distance and
`grain` (smoothed with depth: the engraved lines and the light in rock follow it, so no seams). `shaders.js`: `fieldAt` (cubic), `kindAt/chip/body`
= the nine kinds of rock, `roughOf` how rough their lines are (the user finds smooth parallel lines too clean; twice the present strength hides the cracks); keep `chip` within ~0.1 m of the collision edge. Thread faces: `RAD`/`FACE` in thread.js.
`life.js`: weak lights (`GLOW`) and beasts (none from the Hush down, only thread ends); `kindle.js`: dimming (`dim`, Q/LB; knots of light were removed 2026-11-26 at the user's request), seats
(`RESTS`), `PLACES`; drawing in `drawkindle.js`. `HAND.rouse`: plucking in the Hush rouses the earth. `Drawer.doll()` = her pose, `sift`/`shake` = grit.
Two quiet places off the way: the Orchard (pole 49), the Long Room (pole 50). Skeins and poles go at the end of their lists (saves index them).
Art and props are packed small: paintings/sprites lossless `.webp`, `scripts/props3d/slim.py` after `pack.py`. The films can't be re-encoded smaller.

Checks: `scripts/checks/all.mjs <folder>` (every route check at once), `quiet.mjs` (the two places, the light), `pics.py` (38 views, working tree vs
any commit through `--src`; use it for before/after shots, `--size=2560x1080` too), `logs.py` (the player's logs by stretch). Teleports (`__SD.go`)
leave the thread through rock: for pictures use `from(pole)` and walk with key events. Multi-line shell heredocs with quotes can fail here: write
scripts with the Write tool.

## Builds

`build.cmd` writes `release/Spindledeep-<version>-portable.exe` and `-setup.exe` (Windows). On Linux: `npm version patch --no-git-tag-version`, then
`npx electron-builder --linux AppImage --x64 --publish never` (`npm run dist:linux`) and `npx electron-builder --win portable --x64 --publish never`; the
NSIS `-setup.exe` needs Wine on Linux (it runs the uninstaller to make it), so build it on Windows. Smoke-test a package with
`release/linux-unpacked/spindledeep --ozone-platform=headless --smoke=… --shots=…`.
