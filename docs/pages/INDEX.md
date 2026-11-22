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
