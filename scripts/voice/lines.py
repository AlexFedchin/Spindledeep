"""The knitter's lines (must match app/src/level.js MEMORIES / FINALE) and how each is delivered.
The story turns as it goes deeper (docs/STORY.md): tender at the top, cold by the bottom. `WRONG` lines get a
second, lower voice mixed under hers in pick.py."""

PERSONA = ("Female, about eighty, a frail old grandmother who knits: a soft, slightly hoarse, breathy voice with a "
           "gentle tremor of age, low and quiet, speaking slowly as if remembering, intimate and close; "
           "clear, unhurried English diction.")

WRONG = {'m6': 0.55, 'fin_a': 0.3}

LINES = {
    'm0': ("I've gone down after the light, little one. Don't follow me. ...But if you do, keep hold of the thread. Never let go of the thread.",
           'A note left behind for someone she loves: gentle and reassuring, a pause before "But if you do", then the last sentence slower and a little too insistent.'),
    'm1': ('Seventy winters I sat at that window and listened to the dark breathe. Every winter it calls one name up the well. Last night... it called mine.',
           'Quiet, remembering, with dread underneath; the last two words almost a whisper, afraid.'),
    'm2': ("I made you from the scraps of everything I loved. A sleeve of his coat. The ribbon from my wedding. You're stronger than the others were.",
           'Fond and wistful through the list of things; the last sentence warm on the surface but measuring, as if comparing.'),
    'm3': ("The moths found the others first. Don't grieve for them, little one. They were only practice.",
           'Calm, soft and matter-of-fact, gently dismissive; no grief at all, which is what makes it cold.'),
    'm4': ('Pluck your thread, and the bells will answer. They rang for everyone it took. The ringer rang until his hands bled... and then they rang for him.',
           'Hushed, like telling a secret; the first sentence kind, then quieter and grimmer, a long pause before the end.'),
    'm5': ("Don't let the ink touch you. It makes things forget what they are. I forgot for seventy winters... I forgot that I was made, too.",
           'A warning that turns into a confession; slower, the voice catching before "I was made, too", frightened of herself.'),
    'm6': ("She's so tired, little one. Her yarn's run grey. She can't climb back up. ...Come down. Come and sit with us. It's warm in the Loom.",
           'Slow, flat and too calm, almost sing-song; every word evenly spaced, no tremor, as if someone is reading her words aloud without understanding them.'),
    'fin_a': ("There you are. I came all this way too, once, and tied my thread to an old woman's. Tie yours to mine, little one... someone has to go home.",
           'Very close and very quiet; tired, kind on the surface and empty underneath; the last sentence a soft plea that is really an instruction.'),
    'fin_b': ('There. Next winter, it will call your name. Start knitting early, little one... it takes a few.',
           'A whisper, gentle and almost fond, with no comfort in it at all; a small breath before "it takes a few".'),
}
