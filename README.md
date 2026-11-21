# Spindledeep

*A small, lonely descent on a single red thread.*

You are a little yarn doll. Last night the old knitter who made you went down into the hole
beyond her cottage and did not come back. Her grey thread still runs down into the dark.
You are tied to her door by your own red yarn, and the further you go, the more of
yourself you leave behind.

Spindledeep is a side-view 2.5D game in a world drawn as a living **intaglio engraving**,
the line work of old banknotes and Doré plates. It is rendered in real time by a
hand-written WebGPU renderer. The only colour and the only light is your thread.

## The thread is everything

- **It is your light.** Every few centimetres of thread behind you is a small red lamp, with soft
  shadows marched through the world's distance field. Looking back, your path glows.
- **It is your rope.** Hold *grip* to stop it paying out. Walk off a ledge and you hang.
  Climb or lower yourself. It wraps around rock corners like a real rope, and it snags on
  iron rings in the air, so you can swing across chasms.
- **It is your body.** The doll is made of the yarn. The more you let out since the last peg,
  the thinner it gets, until it can go no further. Walk back to wind it in, or tie it to one of
  the knitter's pegs: that makes the path behind you permanent and safe, refills you, and
  becomes your checkpoint.
- **It is an instrument.** *Pluck* it, and a wave of light runs back along your whole path,
  playing a note tuned to how taut it is. Ink moths that chew warm thread scatter. Bell
  flowers the wave passes start to ring and glow, and the veils that block the way listen
  for every bell your thread has touched.

Along her grey thread are knots that hold the knitter's voice.

## Areas

The Brink · The Throat · The Root Gardens · The Bell Gallery · The Ink Mere · The Loom.
One hand-built level, about 20–30 minutes to play.

## Controls

| | Keyboard | Gamepad |
|---|---|---|
| Walk | A / D or ← / → | Left stick / D-pad |
| Jump | Space | A |
| Grip the thread (hold) | Shift | RT / LT / bumpers |
| Climb / lower while gripping | W / S | Stick up / down |
| Let go mid-swing | Space | A |
| Pluck | F | X |
| Tie at a peg · mend · interact | E | Y / B |
| Pause | Esc | Start |
| Fullscreen | F11 / Alt+Enter | |

## Run it

Requires **Node.js 20+** and a GPU with **WebGPU** (any recent Windows 10/11 driver).

```
run.cmd            # Windows: installs Electron on first run, then plays
./run.sh           # macOS / Linux
npm install && npm start
```

## Build the .exe

```
build.cmd                         # or: npm run dist
```

This produces `release/Spindledeep-1.0.0-portable.exe` (a single file, no install needed) and
`release/Spindledeep-1.0.0-setup.exe` (an installer).

## How it is made

| Part | Where |
|---|---|
| Electron shell, `app://` protocol, smoke/screenshot mode | `electron/main.js` |
| WebGPU renderer (light compute → engrave → thread), WGSL | `app/src/renderer.js`, `app/src/shaders.js` |
| Level layout (carve/fill primitives), areas, entities, script | `app/src/level.js` |
| Terrain rasteriser, noise erosion, exact SDF (Felzenszwalb) | `app/src/terrain.js` |
| The thread: Verlet rope, pegs, grip pivots, wrapping, waves | `app/src/thread.js` |
| The doll's controller | `app/src/player.js` |
| Rules: moths, bells, veils, ink, drips, memories, lights | `app/src/world.js` |
| Procedural sprite art (doll, moths, cottage, props, particles) | `app/src/draw.js` |
| Mix, ambience beds, the harp | `app/src/audio.js` |

### How the engraving works

Each frame computes one *tone* per pixel: the rock's albedo times light, the backdrop paintings,
the ink mirror, and the sprites. It then draws that tone as line work. A family of lines
whose width tracks the tone gives you black lines on paper in the lights and thin white lines
on ink in the darks. Cross-hatching only appears in the mid-tones. Rock lines follow the
iso-contours of the distance field, so they hug every rock face. Backdrop lines bend with the
painting's brightness, which gives relief. Everything "boils" at 8 fps like hand-drawn animation.

### Asset pipelines (`scripts/`)

- `scripts/art/generate.py` produces backdrop paintings with SDXL / RealVisXL locally.
  `pack.py` splits each one by depth (Depth Anything V2) into a packed tone map
  (far tone, near tone, near matte, depth).
- `scripts/voice/record.py` performs the knitter with Qwen3-TTS VoiceDesign from per-line directions.
  `pick.py` scores the takes with Whisper and builds the final voice files.
- `scripts/audio/build_audio.py` turns Freesound CC0 recordings and Kevin MacLeod music into
  the game's sounds (slicing, seamless loops, loudness, Vorbis).
- `scripts/icon.py` draws the app icon.

The GPU environments and models are not in the repo (they live in git-ignored `.cache`
folders). The built assets in `app/assets/` are committed, so the game runs without them.

## Credits

See [CREDITS.md](CREDITS.md). The code is MIT. The type is IM FELL English (SIL OFL). Music is by
Kevin MacLeod (CC BY 4.0). Sounds are from Freesound contributors (CC0).
