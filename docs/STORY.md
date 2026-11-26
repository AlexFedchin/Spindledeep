# Spindledeep — the story (SPOILERS)

The user asked not to be spoiled on the plot. Keep this out of chat summaries and out of the open parts of
changes pages; put it only behind a sealed spoiler block. The epilogue film's content stays out of everything.

## Design brief (from the user, 2026-11-22)
Not straightforward from beginning to end; much darker, ominous and unexpected; the further the game goes, the
darker it gets. The plot was rewritten against that brief.

## The truth, in order of discovery (rewritten 2026-11-24: the user found the old ending cringe and ambiguous)
Rule for the end: **the thing is never explained, everything else is.** What it wants, why it calls names, what each choice
does, and what became of the knitter and the doll are all said in plain words, in the game.

- **The first (the Shoe; knot m9).** A child fell down the well, before the cottage was built. She called for her mother for
  three days. Something down there listened; it had never heard a voice. It says everything she says. On the fourth day it
  was the one calling. *It learned that when you call a name, someone comes down.*
- **How it gets the names (m5, m7).** Whoever comes down is sat in a chair, gently, and asked who they miss. They tell it.
  Then it calls them, too. Forty-one chairs. It called her husband; he said her name aloud in the dark; that is how it had hers.
- **The knitter (m0–m5, m10).** A real old woman, called last winter. She had made dolls before and sent them down ("the
  others") after the ones it took. She died the first night. m0: "Don't follow me" was hers; "keep hold of the thread, never
  let go of the thread" was it, finishing her sentence. From m6 on, any voice that coaxes is it (m6, m8, all of the finale).
- **The doll.** Never named, mouth sewn shut, on purpose (the Cellar's spool NEVER NAME THEM; the Quiet Room's pattern):
  it can't be asked, and it can't be called.
- **What it wants (m10, her own last words).** It can't climb. It needs one thread running from the bottom to the top, and the
  doll has just laid one. "When it begs you with my voice, bite your thread in two."

## The Loom
- **The floor: the called.** Twenty-one people in nightclothes with their backs turned. Whoever the doll is not looking at turns
  round (no eyes, mouth stretched open) and comes a little nearer. She can only walk among them.
- **The dark.** When she leaves the peg (and m10 has been heard out) every mouth calls at once and a dark full of arms rises.
  Something on all fours comes up the far wall after her, in jerks.
- **The top.** A high dark place. Her candle, what is left of her under the shawl, her spectacles. Past the light
  the knitter kneels, holding out the end of the grey thread: the thing, with her voice and her face (her body is the one under the shawl). She begs (fin_a; if she lingers fin_love,
  fin_mama in the child's voice, fin_tieit). As the doll stays she leans nearer on a neck that is never quite the length it was. The choice is shown as two columns that say what each does; the key is held.

## The two endings (`app/src/ending.js`)
- **Tie.** Silence; the candle goes; "Mama?". Light comes up on her, still kneeling (the same size: the user saw her grow in the dark and disliked it); the neck goes up into the dark and comes down
  over the doll, the head the wrong way up; it turns over, thanks her with every voice it has, waits, and calls. Then five places she came through, seen from a
  camera that doesn't move, as it comes, still in her shape, hand over hand up the thread and everything goes out behind it; the last is the
  lip of the pit (since 2026-11-26), black, and the film takes it up there: hands (`shots_end.py` O2, O1, O3-O7; in O1 it walks home along the thread). Cards: it was never her; it needed one thread; by morning no one was left in the valley to call;
  the doll sits in her window, still holding the thread.
- **Bite** (remade 2026-11-25, and again 2026-11-27 to the user's brief: it screams in panic and runs at once). The red goes out of
  the thread from the bitten end. It screams "WHAT HAVE YOU DONE??" (`scream`, her voice with the lower one under it) and bolts on all
  fours along the floor behind the doll, past the candle (it gutters), and over the edge of the beam into the Loom. The red dies up the
  thread in two places (the Hall of Chairs, her door); the wind drops. It comes up the well on what is left of the thread; the thread
  parts; it hangs, looks, falls. The doll walks back to the candle
  and what is left of the knitter. The face comes, asks ("That isn't a name. What is your name?"), goes over her head, asks again, blows the
  candle out. Film (`shots_end.py` C1-C5, cut.mp4): the Brink thaws, her empty window with the sweet peas, the dead thread into the pit, down the
  well, and what sits in her chair with the doll in its lap, whispering names, until it looks up. Cards: it can never climb out, no one will
  be called again; she had been dead since the first night; the snow melted; the doll is still down there, nameless, so it cannot call
  her; it is trying every name there is.
  After the credits: the film `names.mp4` (N1): the doll sits in the light of the well, it goes round the walls behind her and tries names; at the
  fifth she looks up; it reaches the mouth of the well and the light goes.

## The deep
- **The Hall of Chairs.** Forty-one rocking chairs with shawls; her candle by an empty one. m7.
- **The Hush.** Arms that break out of the earth after anything that passes. m8 is the thing: it tells you not to pluck.
- **The Treadles.** m9, the child, on a faded red thread.

## Her letters and the seats (2026-11-27)
- **Letters** (`SKEINS[].letter` in level.js; nine of the ten skeins became letters when the thread stopped running out): one dropped down the
  well each winter to her husband, "My dear", signed only "me" (she never writes a name). By depth: the kettle on for him; the dolls knit
  small, sorry about the mouths; the bells counted; the ringer's wife; he said her name and something said it back (Ink Mere, with m5);
  the room of chairs, don't tell it anything else (Hall, with m7); his voice at her door, which doesn't know who takes sugar (Hush); the
  garden moving under the snow (Hush); the night it called her, going down with the last doll (Treadles). Kept on her shelf.
- **Seats** (`REST_SAYS`, written, not spoken): a tally that stops; a knitted cushion; the barren orchard; a scratched line above the ink,
  rising; eleven pins, one per doll that got this far; a seat still warm; DO NOT SLEEP HERE, in three hands, the last hers.

## Escalation map (deeper = darker)
| Area | Knot | What it adds | Remains |
|---|---|---|---|
| The Brink | m0 | a loving note that insists a little too hard on the thread | — |
| The Throat | m1 | the dark calls one name a winter; this winter, hers | button eye · one face down |
| Root Gardens | m2, m3 | "the others"; "only practice" | one slumped · one eaten hollow |
| Bell Gallery | m4 | the bells rang for everyone it took, then for the ringer | one hung · one fell short |
| Ink Mere | m5 | her husband said her name, and it heard | one on the first island · one in the ink |
| Down to the Loom | m6 | something speaking with her voice | — |
| Hall of Chairs | m7, m11 | how it has the names; they said them aloud and thought it was prayer | dolls in the chairs' laps, in the pews |
| The Hush | m8, m12 | the voice wants you dead; the arms | dolls held in the walls |
| The Treadles | m9, m13 (it has been listening for your feet) | the child: "it says everything I say" | dolls crushed in the heddles |
| The Loom | m10, fin_*, cut*, names | what it wants, what to do, and the choice | the called; her |

## Where it lives
- Lines: `app/src/level.js` (`MEMORIES`, `FINALE`, `SECRETS[].text`), voice script `scripts/voice/lines.py`
  (record.py → pick.py; `WRONG` lines get the double).
- Remains: `app/src/props.js` (`LORE` husk entries, `huskBody`, `drawHusks`); your deaths: `World._die` → `world.husks`,
  saved as `husks` in `main.js`.
- Ending: `app/src/ending.js` (timelines, cards), `drawend.js` (the called, the dark, the thing, the climb), `deep.js` (the called,
  the rising dark, the crawler). Film: `scripts/cine/shots_end.py` (O1-O7), cut in `edit.py` (`outro`).
