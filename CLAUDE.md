# Spindledeep — working notes for Claude

Electron 45 + raw WebGPU side-view platformer drawn as an intaglio engraving; a red thread is the
player's tool and nearly the only light. Source is `app/src/`, level data is `app/src/level.js`.

## Change pages (standing rule from the user)

After **every** change the user asked for, publish a changes page as an Artifact and give them the link.

- One page per change (or per closely related group of changes made in one go), not one page for a whole session.
- **Visual changes get before/after screenshots in a reveal slider**: the before image underneath,
  the after image on top clipped to the right of a draggable red-thread divider. Take the *before*
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
- Screenshots go in the page's `img/` folder as ~1200 px wide JPGs and are published with `files`.
- Earlier pages: original write-up https://claude.ai/artifact/X7CAu6EX2KnXzAq5mpNZbz,
  polish pass https://claude.ai/artifact/75LuG1uAroYU4dzHWNbkHc. Add each new link to
  `docs/pages/INDEX.md`.

## Testing headlessly

- `unset ELECTRON_RUN_AS_NODE; node_modules/electron/dist/electron.exe . --smoke=out.png --shots=list.json`
  where the list is `[{js, wait, out, log}]`. `window.__SD` exposes `begin()`, `go(x,y)`, `W` (world),
  `cam`, `SWING` (live swing tuning).
- Swing/level feasibility: drive `new __SD.W.constructor(__SD.W.T)` synchronously with fake input
  (see `docs/pages/INDEX.md` for what was verified). Any change to swing physics or ring/platform
  positions must be re-verified for all 12 ring gaps.
- Python here defaults to cp1251: run edit scripts with `PYTHONUTF8=1` or pass `encoding='utf-8'`.

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
- EEVEE Next gotchas: a world volume swallows the sun (use `lib.fog_box`); compositor colour inputs clamp
  negatives (offsets go through math nodes).

## Builds

`build.cmd` writes `release/Spindledeep-1.0.0-portable.exe` and `-setup.exe`.
