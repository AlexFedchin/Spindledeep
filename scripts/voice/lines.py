"""The knitter's lines (must match app/src/level.js MEMORIES / FINALE) and how each is delivered.
The story turns as it goes deeper (docs/STORY.md): tender at the top, cold by the bottom. `WRONG` lines get a
second, lower voice mixed under hers in pick.py."""

PERSONA = ("Female, about eighty, a frail old grandmother who knits: a soft, slightly hoarse, breathy voice with a "
           "gentle tremor of age, low and quiet, speaking slowly as if remembering, intimate and close; "
           "clear, unhurried English diction.")

WRONG = {'m6': 0.55, 'fin_a': 0.3, 'm8': 0.6}
# the deep (2026-11-23): m9 is not her at all but the knitter before her, an older, different woman (her own persona,
# design takes only); m10 is the chorus, all of them at once (pick.py layers the take into several pitched voices)
OTHER = {'m9': ("Female, about ninety-five, an ancient woman from another century: a deep, dry, rasping, very slow voice, "
                "heavy rural accent softened by age, each word worn smooth, faint and far away as if from the bottom of a well; English.")}
CHORUS = {'m10': 6}

# Re-recording (2026-11-22) for a voice that sounds old: candidate voice descriptions for casting (cast.py tries each
# with several seeds and keeps the one that measures oldest, see age.py), and the sentence the candidates read.
PERSONAS = [
    "Female, eighty-eight years old, a very old and frail grandmother: a thin, papery, quavering voice that trembles and "
    "wobbles on every held vowel, hoarse and cracked, low and dull with age, airy and breathy, speaking slowly with small "
    "catches of breath between phrases; clear English diction.",
    "An elderly woman in her late eighties with a weak, shaky, raspy old voice: tremulous and croaky, worn thin by age, "
    "lower than a young woman's, soft and slow, the words a little loose on old lips; English.",
    "A very old lady, about ninety: a dry, crackly, wavering voice with a strong tremolo, low-pitched for a woman, breathy "
    "and frail, hesitant, the voice of a great-grandmother by the fire; slow, clear English.",
]
REF_TEXT = "I've kept this cottage seventy winters, and I'll keep it a while yet. Sit by the fire, little one, and mind the yarn."

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
    'm7': ("So many chairs. I counted them on my way down... forty-one. Every one of them has my shawl over it. Every one of them is mine.",
           'Bewildered and slow, counting under her breath; the last sentence falls away into quiet horror, very soft.'),
    'm8': ("Hush now, little one. Hush. Don't pluck your thread down here... they don't like the noise. Be quiet, and they'll let you by.",
           'A lullaby voice, soothing and slow, much too sweet; the kindness is a lie and the voice does not care whether you live.'),
    'm9': ("There you are. I came all this way too, once, and tied my thread to an old woman's. Tie yours to mine, little one... someone has to go home.",
           'Very tired and very old, almost mechanical, as if she has said these exact words many times before and will again.'),
    'm10': ("Forty-one winters. Forty-one of us. Every one of us came down for the one before. Sit down, little one. Sit down, and be still.",
            'Slow, low, even and hollow, like a congregation reciting; no feeling at all, every word given the same weight.'),
    'fin_cut': ("Oh... oh, little one. It's so quiet.",
                'Surprised, then relieved and frightened at once, a long breath out; the last words barely a whisper.'),
}
