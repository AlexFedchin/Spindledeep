# Spindledeep — the story (SPOILERS)

The user asked not to be spoiled on the plot. Keep this out of chat summaries and out of the open parts of
changes pages; put it only behind a sealed spoiler block. The epilogue film's content stays out of everything.

## Design brief (from the user, 2026-11-22)
Not straightforward from beginning to end; much darker, ominous and unexpected; the further the game goes, the
darker it gets. The plot was rewritten against that brief.

## The truth, in order of discovery

**Premise (what it seems).** A grandmother who knits has gone down the pit under her cottage "after the light".
She leaves a note telling her yarn doll not to follow, and her grey thread with her voice knotted into it.
The doll follows on its own red thread to bring her home.

**What is really going on.**
- The pit was the village well. Every long winter the dark at the bottom calls one name up the shaft, and whoever
  is called goes down to the Loom and is woven in. The village tried everything: the windlass and bucket, miners
  digging down to kill it (their coats came back up, folded), a chapel of bells rung for everyone it took (the
  ringer rang until his hands bled, then they rang for him), a ferry across the ink. The village is gone. There has
  been no spring on the Brink for seventy years.
- **Turn 1 — you are not the first.** The knitter has been making dolls and sending them down. Eight lie along the
  route, grimmer the deeper you go (a lone button eye, bodies face down, one eaten hollow by moths, one hung from a
  stake by its own thread, one blackened by the ink). "You're stronger than the others were." "They were only
  practice." Your own deaths leave bodies too, and they stay.
- **Turn 2 — she was made, too.** At the Ink Mere she confesses that the ink made her forget, for seventy winters,
  that she is a doll herself. Seventy winters ago the old woman who lived in the cottage was called; she made a doll;
  the doll followed her down, tied the threads, and went home to sit in her chair. That doll is the knitter.
  (Keepsakes: her first spool scratched I WAS MADE; a thimble dented by the woman who knitted her.)
- **Turn 3 — the voice is not hers any more.** The last knot before the Loom speaks with her voice and the wrong
  words ("She's so tired... Come and sit with us. It's warm in the Loom"), with a second, lower voice under it.
  Her chair at the bottom is empty. Her candle is still burning beside it.
- **The end — the trap is the rescue.** "I came all this way too, once... someone has to go home." Tying the
  threads is the thing the player came to do, and it is the ritual: her candle goes out, the red runs up the grey
  thread all the way to the cottage window, and her last line lands: "There. Next winter, it will call your name.
  Start knitting early, little one... it takes a few." The doll goes home to become the next knitter, who will make
  dolls and send them down to die. The epilogue film plays after this (its content is not described here).

## The deep (added 2026-11-23, to the user's brief: much longer, a better ending, something terrifying in the Loom)
The old bottom chamber is no longer the end. Below the Ink Mere the way goes much deeper, through four new areas.
- **The Hall of Chairs** (the old Loom chamber). Rows of rocking chairs, dozens, each with a cold candle and the same
  grey shawl. One candle still burns: hers. She is not in her chair; her grey thread goes on, down a hole in the floor.
  Knot m7, her own voice, sad and sane: there are forty-one chairs; every one of them has her shawl. *Every knitter was
  the same woman: each doll is made in the image of the one who made it.*
- **The Hush.** Dark caverns whose walls are packed grey cloth. Knitted grey hands reach out of them toward anything
  that is quiet; a pluck drives them back, lit bells keep them still. Knot m8 is the wrong voice (her voice with the
  low double, as m6): "Hush now, little one. Don't pluck... they don't like the noise." *The voice is trying to kill you.*
- **The Treadles.** The Loom's undercroft: treadles and lams, heddle frames slamming down to the beat of the Loom,
  rings swinging on chains. Knot m9 is on a different thread: faded red, very old, a doll's thread from seventy winters
  ago, and the voice in it is not hers: an older woman, the knitter before her, saying the exact words the knitter will
  say at the end ("There you are. I came all this way too, once..."). *The ending is a script; it has been said
  forty-one times.*
- **The Loom.** A cavern 130 m high strung with warp threads. Its floor is woven cloth and the cloth is faces: all the
  same face, hers. Knot m10 is the chorus (many of her voices at once): forty-one winters, forty-one of us, sit down and
  be still. When the doll steps onto the cloth, the Weaver wakes: the cloth heaves up into one vast figure with her face
  and starts to rise after the doll. The doll climbs the warp threads to the breast beam at the top, past needles that
  stab out of the cloth. At the top the knitter sits woven in to the waist, her candle beside her, and the grey thread
  ends in her hands.
- **Two endings.** Tie (act): the old ending as before (fin_a, fin_b, the red pulse home, the epilogue film); the cycle
  goes on. Bite through her thread (pluck): fin_cut, "Oh... oh, little one. It's so quiet." The Weaver stops; the faces
  close their eyes; her candle goes out. Something below takes hold of the red thread, the last line to the surface;
  the doll bites through its own thread too, and the light goes out. Cards: that winter no name was called up the well;
  in the spring the snow on the Brink began to melt. After the credits: the doll in her chair in the dark, and the
  sound of needles.

## Escalation map (deeper = darker)
| Area | Knot | What it adds | Remains |
|---|---|---|---|
| The Brink | m0 | a loving note that insists a little too hard on the thread | — |
| The Throat | m1 | the dark calls one name a winter; this winter, hers | button eye · one face down |
| Root Gardens | m2, m3 | "the others"; "only practice" | one slumped · one eaten hollow |
| Bell Gallery | m4 | the bells rang for everyone it took, then for the ringer | one hung · one fell short |
| Ink Mere | m5 | she was made too | one on the first island · one in the ink |
| Down to the Loom | m6 | something speaking with her voice (pitch-shifted double, `WRONG` in `scripts/voice/lines.py`) | — |
| Hall of Chairs | m7 | forty-one chairs, one woman | dolls in the chairs' laps |
| The Hush | m8 | the voice tells you to stop plucking, to kill you | dolls held in the wall hands |
| The Treadles | m9 | the end is a script: an older voice says her last words | dolls crushed in the heddles |
| The Loom | m10, fin_a/b, fin_cut | the faces, the chorus, the Weaver, the choice | your own, if you died |

## Where it lives
- Lines: `app/src/level.js` (`MEMORIES`, `FINALE`, `SECRETS[].text`), voice script `scripts/voice/lines.py`
  (record.py → pick.py; `WRONG` lines get the double).
- Remains: `app/src/props.js` (`LORE` husk entries, `huskBody`, `drawHusks`); your deaths: `World._die` → `world.husks`,
  saved as `husks` in `main.js`.
- Ending: `main.js` `startEnding` (candle out), `draw.js` `drawFinale` (snuffed candle smoke).
- Epilogue edit: `scripts/cine/edit.py` (`CODA`).
