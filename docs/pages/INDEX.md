# Spindledeep changes pages

House style and rule: see `CLAUDE.md`. Template: `_template.html`, builder: `mkpage.py`.

| Page | Link |
|---|---|
| Original write-up | https://claude.ai/artifact/X7CAu6EX2KnXzAq5mpNZbz |
| Polish pass | https://claude.ai/artifact/75LuG1uAroYU4dzHWNbkHc |
| 1. Heavier swing (`swing/`) | https://claude.ai/artifact/JzmLpGyUBh3znCBjUsrkhB |
| 2. Woodpile (`firewood/`) | https://claude.ai/artifact/NWsF2b8neqxPDeXkb87drj |
| 3. Cave relics (`relics/`) | https://claude.ai/artifact/2SAfoyAEphasPyCVz1D1Ac |
| 4. Snowstorm (`storm/`) | https://claude.ai/artifact/Nh1VeLbx1fMGjRYnnwYxuB |
| 5. Films (`films/`) | https://claude.ai/artifact/B9a7TyCcgErULkacr4ToKs |
| 6. Dead ends fixed (`deadends/`) | https://claude.ai/artifact/G8XsmEWzRJh2bCP3XYXowF |
| 7. A swing has to be earned (`swinghang/`) | https://claude.ai/artifact/JDuPHDEdDW5Lgax7SXdFro |
| 8. Six hidden rooms (`secrets/`) | https://claude.ai/artifact/TT7w5yYxQK7PtmWbsMjiNK |
| 9. A darker thread: story rewrite (`story/`, plot sealed) | https://claude.ai/artifact/WGTgv9q1fD1XJBdv9Kqnc8 |
| 10. Clean films, kept runs (`filmfix/`) | https://claude.ai/artifact/RqUUscR5hSEKuRaCpLP4Rm |
| 11. The ghost on the title screen (`restart/`) | https://claude.ai/artifact/WB3XZc4gqW8iqyPkNFtitx |
| 12. Her own two hands (`knitter/`) | https://claude.ai/artifact/MswAJ32Cd7SY1zfuP2jvV1 |
| 13. Seventy winters in her voice (`oldvoice/`) | https://claude.ai/artifact/KQdLD1viJRnYPpcjy6WBMh |
| 14. Four small mends (`mends/`) | https://claude.ai/artifact/WvqLyGh8TYMumLFxf7kzcc |
| 15. Her, at last: the old-lady model (`oldlady/`) | https://claude.ai/artifact/7RuHZ4rS7YwJKUTTZ9ZKDt |
| 16. Much deeper: four new areas, the Loom, a second ending (`deep/`, plot sealed) | https://claude.ai/artifact/9FAgaVuMKJjeRyNrvpxfRS |
| 17. The cave breathes: zoom by room size, look up/down (`camera/`) | https://claude.ai/artifact/AzfFSJ6SAUkTvQczMzuRap |
| 18. Out into the storm: prologue → game handover, walk out of the cottage, hidden pointer (`walkout/`) | https://claude.ai/artifact/3D4qdQVi67pjES3hUbNQeu |
| 19. No hard cuts: passages between screens, pause/respawn/hidden-room/text easing (`passages/`) | https://claude.ai/artifact/Mva3aPJTUhkcPfYoeYTJVS |
| 20. Held up to the light: keepsakes and skeins shown full screen, game paused (`keepsakes/`, keepsake words sealed) | https://claude.ai/artifact/JcxvsDdLF2tCXTsmfmFfvP |
| 21. Kept out of the rock: thread vs rock, harder hands, earth sounds, no rope creak, no brass (`rockthread/`) | https://claude.ai/artifact/R161kCaf6HSZvYkHuLaabt |
| 22. What is down there: the Loom, both endings and the film remade (`ending/`, plot sealed) | https://claude.ai/artifact/J1avXLArMvcKdXb2hRBTGz |
| 23. Listen: two keepsakes drawn, rooms that open in time, sound that follows the cave (`listen/`) | https://claude.ai/artifact/NZ8LqQVJhCyzqS1shjTGD7 |
| 24. The Ending: the monster is a live 3D figure; both endings scene by scene, with clips (`face/`, open) | https://claude.ai/artifact/8soWEEYQZJFzENtU2f5s7K |

## Swing verification (2026-11-21)
All 12 ring gaps pass with `SWING` in `app/src/player.js`, simulated for grip-held-early and grip-at-ring,
holding forward and leaning with the swing, let-go times 0.1–6 s (scratchpad solver `verify2.js`).

## Route verification (2026-11-22)
Scratchpad probes `probe2.js` (bramble points on floors, grey-thread rock crossings, doll-clearance flood fill
from START to every peg/skein/memory/finale) and `route.js` (real-physics walks: B1→shaft→Mere shore,
west shore→tunnel→Loom). Teleport-based checks (`__SD.go`) do NOT prove the route is connected — the shaft
dead-ended for the whole project before this. Re-run the flood fill after any carve/fill change.

## Swing pump + hidden rooms (2026-11-22)
Lean is now tangential and speed-scaled (`pumpWith 6, pumpRef 8, pumpStart 0.06`): dead hang against a pillar 61.6° → 4.5°,
open-air pumping grows 6/16/31/52/54/81°. All 12 gaps re-verified (verify2.js; pillar 3→4 hold-forward window is the tightest, 0.6 s).
Scratchpad `secrets.js` walks into and out of all six hidden rooms in real physics (Sill: drop, lower, pump, let go, 14.6 s);
`probe2.js` flood fill includes the keepsakes. Hidden rooms are drawn from a separate visual SDF (`Terrain.visualHalf`/`revealPatch`).

## Story rewrite (2026-11-22)
Plot in `docs/STORY.md` (spoilers; keep out of summaries). All 9 voice lines re-recorded (Whisper acc 0.93–1.0; old takes in
`scripts/voice/.cache/raw_v1`). Death marks: thorn/ink deaths verified to leave a mark that survives save → `__SD.cont()`.
Smoke harness now uses a transparent, inactive, shown window: a never-shown window paused rAF (the loop didn't run).

## Film fixes + saves (2026-11-22)
Re-rendered I1 I2 I7 I8 I9 E2 E3 E5 E7; all 15 re-graded (post.py: clamped-position areas as sky, degenerate line family
overridden; exposure still from the true sky so looks didn't shift). Saves: userData/save.json via IPC (atomic), verified
across three real launches in the smoke profile (Continue resumes at the pole; Begin anew replaces).

## Knitter rebuild (2026-11-22)
New `lib.knitter` with IK arms and jointed hands; I2–I7, E2, E3 re-rendered, both films re-cut. `clipcheck.py` clean on
I2 I3 I4 I6 I7 E2; I5 keeps only fingertip/thumb contact with the doll while lifting it.

## Old voice (2026-11-22)
cast.py → ref cand_2_3 (161 Hz); 108 takes; pick.py keeps 5 design + 4 clone takes, ageing fx in numpy (ffmpeg vibrato +
loudnorm intermittently produced full-scale noise), final files re-transcribed. Age score avg 1.6 → 2.8; pitch 119–218 → 136–166 Hz.
Young set kept in app/assets/voice_young (switch: VOICE_SET in audio.js).

## Four mends (2026-11-23)
Ink drips no longer cut the thread (they cut it lying on the islands under them: 1/10 Mere crossings survived, now 15/16;
scratchpad `mere.js` chains all six gaps from pole 7 with drips on). END cleared on new run/title; chair/spool/candle on
`T.ground`; `mus_end` is a generated dirge (build_audio.py recipe), outro re-cut.

## The deep (2026-11-23)
route2.js segments all pass: Hall→H1 9 s; Hush with plucking (lingering 3 s unplucked kills); Quiet Room both ways;
Treadles rings (per-gap windows at most phases, gaps.js); rope + timed heddles; the two-stage well; Loom cloth→beam
with the cloth rising (~55 s; also from peg 26). Loom ring: 12/20 phases. Both endings run to credits in smoke tests.

## Camera (2026-11-23)
`openness()` in main.js: 24 rays through the collision SDF (unseen secret `hide` rects count as rock), geometric mean.
Over all standing spots: ~1 m crawls → 12+ m Mere/Loom, median 5.7 m (`OPEN.mid`). View = area viewH × (open/5.7)^0.45,
clamped 0.66–1.42, max 31 m. Look up/down only when grounded, not climbing, thread not gripped; pan after 0.2 s hold.
Teleport tests in the Treadles/Hush/Gallery x=90 kill the parked doll (hazards) and respawn at peg 0: pick safe spots.

## Walk-out (2026-11-23)
After the intro film only (`startGame(false, true)`; `__SD.walkOut()` for tests, `__SD.begin()` skips it). `W.intro` drives
door/doll/hints; scripted input `walkInput`. Audio bridge `A.storm()` starts at film end − 4.2 s (verified at 8× playback;
seeking the film throws an AAC decode error → endCine, a test artifact). A light at the doll's height washes her out on the
bright Brink: keep doorway lights low and the room dark. Cursor: `body.nocursor` unless title/loading/paused.

## Passages (2026-11-23)
Every screen change goes through `passage(work, {caption, out, hold, back, sound})` in main.js (#veil over everything,
z 55; caption delayed to 0.9 × fade so it only shows on black; `busy` blocks menus/pause/skip). Work returning 'keep'
leaves the veil for a film to lift once playing. Pause eases `timeScale` and fades the master before suspending.
Respawn: fade to full black by deadT 1.6, `camSnap` + `respawnT` fade-up. Hidden rooms: `T.revealPair` + `revealStep`
morph the SDF patch over 1.5 s. Overlay text via `setText`. Test pitfalls: injected shot JS runs in global scope
(wrap `const` in a block); don't test fullscreen in smoke mode (it would show the window).

## Showcase (2026-11-23)
`startShow`/`showUpdate` in main.js (SHOW, W.showcase): timeScale → 0 (rate 5), camera on the item at view 2.7 m using
real dt, item drawn by `props.drawShowItem` (Pen has a scale `s`), `#show` overlay with staged classes s1–s4/sout.
Dismiss = fresh I.pressed or mousedown after 1.6 s. Item light 0.55 (1.1 washed the skein out). Keepsake words are
story: keep them sealed on pages.

## Thread, hands, the end (2026-11-24)
Checks run in plain node (`node --experimental-default-type=module`, importing app/src): `fuzz.mjs` (random players from all 30
pegs; thread >6 cm in rock 31.4 % -> 0-0.2 % of frames), `gal.mjs` (12 ring gaps, identical release windows to the old build),
`hands.mjs` (no-effort walker dies every time; reacting to warnings gets through), route2 + segs1/2/5. m10 sits at x 67.6: the doll
drops from the Loom ledge to about x 76, so anything further east on the floor can be flown past unheard. `--from=N`
(`to-the-loom.cmd`) adds a title-menu line that starts at pole N with the thread laid. Runs keep their save after an ending.
Test pitfall: `__SD.begin()` during end cards leaves the cards' timers running over the new run.

## Her face (2026-11-25)
3D figures (see CLAUDE.md). Shots: scratchpad `mk3.py`/`mkba.py` (every ending moment), crawler forced on with a setInterval. Jumping
`__SD.end().t` leaves the camera behind (it is damped): let the timeline run for framing. 60 fps before and after.
Clips: scratchpad `mkvid.py`/`viddec.py` (MediaRecorder on `#view`.captureStream(30) plus `__SD.A.out`, base64 out through a shots `log`);
motion faults show only there (contact sheets with ffmpeg `tile`), so record before calling a figure done.

## Items, rooms, sound (2026-11-24)
Keepsakes `pattern` and `shoe` had no `KEEP` drawing and an empty fallback hid it; the fallback is gone, so a missing kind now
throws. Hidden rooms: `open` (rock crumbling, `mouthZone` by walking distance, `at` in level.js, default 3 m) is separate from
`seen` (title card); `world.hiddenAt` follows the crumbling front (`s.rev`). Setting `s.open` by hand in a test skips the rock
patch: teleport to the mouth instead. Scratchpad `run8.json` runs into all eight with real keys (0 frames drawn inside rock);
`zones.mjs` checks no pole or grey thread lies in a zone. Sound tests: record the game's output with a MediaRecorder on
`__SD.A.out`; `rt.json` (one footstep per place, beds disconnected), `soak.json` (3 simulated minutes per area). Moths that sit
on the doll come along when it is teleported and spoil recordings.
