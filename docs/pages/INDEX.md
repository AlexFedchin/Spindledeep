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
