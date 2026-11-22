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

## Swing verification (2026-11-21)
All 12 ring gaps pass with `SWING` in `app/src/player.js`, simulated for grip-held-early and grip-at-ring,
holding forward and leaning with the swing, let-go times 0.1–6 s (scratchpad solver `verify2.js`).

## Route verification (2026-11-22)
Scratchpad probes `probe2.js` (bramble points on floors, grey-thread rock crossings, doll-clearance flood fill
from START to every peg/skein/memory/finale) and `route.js` (real-physics walks: B1→shaft→Mere shore,
west shore→tunnel→Loom). Teleport-based checks (`__SD.go`) do NOT prove the route is connected — the shaft
dead-ended for the whole project before this. Re-run the flood fill after any carve/fill change.
