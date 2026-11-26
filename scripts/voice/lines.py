"""The knitter's lines (must match app/src/level.js MEMORIES / FINALE) and how each is delivered.
The story turns as it goes deeper (docs/STORY.md): tender at the top, cold by the bottom. `WRONG` lines get a
second, lower voice mixed under hers in pick.py."""

PERSONA = ("Female, about eighty, a frail old grandmother who knits: a soft, slightly hoarse, breathy voice with a "
           "gentle tremor of age, low and quiet, speaking slowly as if remembering, intimate and close; "
           "clear, unhurried English diction.")

WRONG = {'m6': 0.55, 'm13': 0.55, 'fin_a': 0.22, 'm8': 0.6, 'fin_love': 0.4, 'fin_tieit': 0.8, 'cut1': 0.45, 'cut2': 0.6, 'cut3': 0.7, 'cut4': 0.5, 'names': 0.6, 'call': 0.7, 'home': 0.45}
# the deep (rewritten 2026-11-24): m9 and fin_mama are the first child who fell down the well (her own persona, design takes
# only); fin_b is the chorus, everyone it has taken at once (pick.py layers the take into several pitched voices)
CHILD_VOICE = ("Female child, about six years old: a small, high, clear, breathy little girl's voice, frightened and trying to be brave, "
               "very close to the microphone, hushed, slow, in a large empty stone place; English.")
OTHER = {'m9': CHILD_VOICE, 'fin_mama': CHILD_VOICE}
# not the old woman: no ageing. m9 gets a second, lower voice half a second behind that says everything the child says
PLAIN = {'m9', 'fin_mama'}
ECHO = {'m9': 0.5}
CHORUS = {'fin_b': 6}

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
    'm5': ("Don't let the ink touch you. It makes things forget. When it called my husband, he forgot his own face down here... but he remembered my name. He said it out loud. And it heard.",
           'A warning that turns into grief; slower and slower, the voice catching on "my name"; the last three words almost soundless, with dread.'),
    'm6': ("She's so tired, little one. Her yarn's run grey. She can't climb back up. ...Come down. Come and sit with us. It's warm in the Loom.",
           'Slow, flat and too calm, almost sing-song; every word evenly spaced, no tremor, as if someone is reading her words aloud without understanding them.'),
    'fin_a': ("There you are. Oh, little one, you came all this way. I'm so cold. I can't see the light. Tie your thread to mine, and pull me up. Please. Please.",
           'Weak, freezing, pitiful, pleading; heartbreakingly sincere; the second "please" exactly the same as the first.'),
    'fin_b': ('Thank you, little one. Now we can all come up.',
           'Slow, hollow and satisfied, like a congregation reciting; no feeling at all, every word given the same weight.'),
    'm7': ("Forty-one chairs. It sits you down, little one. It's so gentle. It asks you who you miss... and you tell it. Then it calls them, too. That is how it has our names.",
           'Quiet, shaken, confessing something unforgivable; a long pause after "who you miss"; the last sentence barely held together.'),
    'm8': ("Hush now, little one. Hush. Don't pluck your thread down here... they don't like the noise. Be quiet, and they'll let you by.",
           'A lullaby voice, soothing and slow, much too sweet; the kindness is a lie and the voice does not care whether you live.'),
    'm9': ("Mama? I fell down the well. It's dark. Mama, there's something down here with me. It says everything I say.",
           'Whispering, frightened, pausing to listen between sentences; the last sentence slow and very quiet, as if it might hear.'),
    'm10': ("This is the last of me, little one. I told you, don't follow. Never let go of the thread... that part was not my voice. It can't climb. It needs one thread, from here to the top, and you have brought it one. When it begs you with my voice, bite your thread in two. I never gave you a name. So it can never call you.",
           'A dying woman using her last breath to warn someone she loves: urgent but weak, clear, every sentence deliberate; tender only on the last two sentences.'),
    'm11': ("They sat in rows down here, little one, and said them aloud. The names of everyone they had lost. They thought that they were praying.",
            'Quiet and pitying, remembering something seen; slower on the last sentence, which she says almost to herself, with horror held back.'),
    'm12': ("When it moves in the walls, be still. I was still for a whole winter, once. It sat beside me the whole time.",
            'A warning, whispered very close; a long pause after "once"; the last sentence flat and tired, as if it were a small thing.'),
    'm13': ("I can hear you coming down. Such small feet. ...I never gave you feet that make a sound.",
            'Fond and warm at first, almost smiling; a long silence; the last sentence slow, level and wrong, much too calm.'),
    'fin_love': ("Don't you love me? I made you. Don't you love me?",
           'Hurt and soft; both questions said in exactly the same way, like a recording.'),
    'fin_tieit': ('Tie it. Tie it. Tie it. Tie it. Tie it.',
           'Completely flat, patient, mechanical; the same two words with the same spacing, no emotion.'),
    'fin_mama': ('Mama?',
           'One word, very small and lost, in the dark.'),
    'cut1': ('What have you done?',
           'Very quiet, gentle, almost kind; a pause before the last word; no emotion.'),
    'cut2': ("You let go. You were never to let go.",
           'Low and slow, the kindness gone out of it; the first three words flat, then the second sentence leaning close, each word separate, cold.'),
    'cut4': ('Hold on to me!',
           'Suddenly loud and desperate, falling away, the voice cracking and breaking up on the last word.'),
    'cut3': ("Little one? Little one? That isn't a name. What is your name?",
           'Calling softly into the dark, sweet, patient; then flat and cold on "That isn\'t a name"; the last question almost a whisper, very close.'),
    'names': ('Ada? Agnes? Alice? Anna? Beatrice? Bertha? Catherine? Clara? Dora? Edith? Eleanor? Ellen? Emma?',
           'Whispering names into the dark one by one, each a question, patient, a long listening pause after every name; it has all the time in the world.'),
    'call': ('Thomas! Mary! William! Ruth! Eleanor! John!',
           'Calling people by name from far away across the snow at night, the way a mother calls children home at dusk; warm, sing-song, long drawn-out vowels, a pause after each.'),
    'home': ("There. We're home.",
           'Warm, contented and wrong, very close, barely above a whisper.'),
}
