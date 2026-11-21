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

## Swing verification (2026-11-21)
All 12 ring gaps pass with `SWING` in `app/src/player.js`, simulated for grip-held-early and grip-at-ring,
holding forward and leaning with the swing, let-go times 0.1–6 s (scratchpad solver `verify2.js`).
