"""Changes page: the story rewrite (`story/`). The plot itself is sealed in a <details> block, since the user asked
not to be spoiled. Usage: python mk_story.py <scratchpad with before_/after_ PNG shots>"""
import os, sys, re, html
from PIL import Image
from mkpage import page, reveal, hero, HERE

SCR = sys.argv[1]
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
PREV = (' &middot; <a href="https://claude.ai/artifact/JzmLpGyUBh3znCBjUsrkhB">swing</a> &middot; <a href="https://claude.ai/artifact/NWsF2b8neqxPDeXkb87drj">woodpile</a>'
        ' &middot; <a href="https://claude.ai/artifact/2SAfoyAEphasPyCVz1D1Ac">relics</a> &middot; <a href="https://claude.ai/artifact/Nh1VeLbx1fMGjRYnnwYxuB">storm</a>'
        ' &middot; <a href="https://claude.ai/artifact/B9a7TyCcgErULkacr4ToKs">films</a> &middot; <a href="https://claude.ai/artifact/G8XsmEWzRJh2bCP3XYXowF">dead ends</a>'
        ' &middot; <a href="https://claude.ai/artifact/JDuPHDEdDW5Lgax7SXdFro">a swing has to be earned</a>'
        ' &middot; <a href="https://claude.ai/artifact/TT7w5yYxQK7PtmWbsMjiNK">six hidden rooms</a>')
D = os.path.join(HERE, 'story', 'img')


def jpg(src, name, crop=None):
    os.makedirs(D, exist_ok=True)
    im = Image.open(os.path.join(SCR, src)).convert('RGB')
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    im = im.resize((1200, round(im.height * 1200 / im.width)), Image.LANCZOS)
    im.save(os.path.join(D, name), quality=86)


# the lines, straight from the game data so the page can't drift from it
lv = open(os.path.join(ROOT, 'app', 'src', 'level.js'), encoding='utf-8').read()
def jsstr(s):
    return s[1:-1].replace("\\'", "'").replace('\\"', '"')
mem = {m.group(1): jsstr(m.group(2)) for m in re.finditer(r"\{ id: '(m\d)', x: [^,]+, y: [^,]+, text: (\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^'\\\\]|\\\\.)*')", lv)}
fa = jsstr(re.search(r"  text: (\"[^\"]*\"|'[^']*'),\n  after:", lv).group(1))
fb = jsstr(re.search(r"  after: (\"[^\"]*\"|'[^']*'),", lv).group(1))
keeps = [(m.group(1), jsstr(m.group(3))) for m in re.finditer(r"name: (\"[^\"]*\"|'[^']*')[^\n]*what: '([^']*)',\n    text: (\"[^\"]*\"|'[^']*')", lv)]
keeps = [(jsstr(n) if n[0] in '"\'' else n, t) for n, t in keeps]

where = {'m0': 'The Brink, at the lip of the pit', 'm1': 'The Throat', 'm2': 'The Root Gardens', 'm3': 'The Root Gardens, by the moths',
         'm4': 'The Bell Gallery', 'm5': 'The Ink Mere', 'm6': 'The way down to the Loom'}
lines_rows = '\n'.join(f'          <tr><td>{where[k]}</td><td>{html.escape(mem[k])}</td></tr>' for k in sorted(mem))
lines_rows += f'\n          <tr><td>The Loom, at the empty chair</td><td>{html.escape(fa)}</td></tr>'
lines_rows += f'\n          <tr><td>When the red reaches the cottage</td><td>{html.escape(fb)}</td></tr>'
keep_rows = '\n'.join(f'          <tr><td>{html.escape(n)}</td><td>{html.escape(t)}</td></tr>' for n, t in keeps)

spots = [('l1', 'The Throat, first ledge', 'a lone button eye and a scrap of knitting'),
         ('l4', 'The Throat, fourth ledge', 'a doll face down at the end of the ledge'),
         ('g1', 'The Root Gardens, first cave', 'one slumped on the floor'),
         ('g2', 'The Root Gardens, by the moths', 'one eaten hollow, its rows pulled loose'),
         ('p1', 'The Bell Gallery, first pillar', 'one hung from a stake by its own thread'),
         ('p4', 'The Bell Gallery, fourth pillar', 'one that fell short of the last ring'),
         ('i1', 'The Ink Mere, first island', 'one that got no further'),
         ('i4', 'The Ink Mere, fourth island', 'one the ink got into')]
crop = (0.18, 0.28, 0.88, 0.78)
for k, *_ in spots:
    jpg(f'before_{k}.png', f'{k}_before.jpg', crop)
    jpg(f'after_{k}.png', f'{k}_after.jpg', crop)
sliders = ''
for k, area, what in spots:
    sliders += reveal(k, f'{k}_before.jpg', f'{k}_after.jpg', f'Before: {area}, empty', f'After: {area}, {what}')
    sliders += f'    <p><b>{area}.</b> {what[0].upper() + what[1:]}.</p>\n'

SEAL = '''
  <style>
    details.seal { margin: 34px 0 10px; border: 1px solid var(--rule); background: var(--ink-2); }
    details.seal > summary { cursor: pointer; list-style: none; padding: 22px 24px; text-align: center;
      font-family: var(--mono); font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--red); }
    details.seal > summary::-webkit-details-marker { display: none; }
    details.seal > summary span { display: block; margin-top: 8px; font-family: var(--italic, 'IM Fell English', serif);
      font-style: italic; text-transform: none; letter-spacing: 0; font-size: 16px; color: var(--paper-dim); }
    details.seal[open] > summary { border-bottom: 1px solid var(--rule); }
    details.seal .inner { padding: 4px 24px 26px; }
    table.windows td, table.windows th { vertical-align: top; white-space: normal; }
  </style>'''

body = hero('story rewrite', 'A Darker Thread', 'The plot no longer runs straight', 'and the deep gets colder the further down you go') + SEAL + f'''
  <div class="col summary">
    <p>I read the whole story as it stood: every line her voice speaks, the keepsakes, the props, the ending and both films. It didn't meet any of your three criteria. It was a gentle story with one feeling from start to finish, and its first line already told you how it would end.</p>
    <p>It's rewritten now. Every spoken line and every keepsake text is new, and the story turns twice before the end. The ending scene plays out differently and the epilogue film has been re-cut. Things along the route now get grimmer the deeper you go. The plot itself is sealed further down this page, so you can play it first.</p>
  </div>

  <h2>Your three criteria</h2>
  <p class="ask">It should not be straightforward from the beginning till the end. It should be much darker, more ominous and unexpected. And the further the game goes, the darker it should get.</p>
  <div class="col">
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Criterion</th><th>Before</th><th>Now</th></tr></thead>
        <tbody>
          <tr><td>Not straightforward</td><td>One idea, stated in the first line and delivered at the end</td><td>Two turns, at the Root Gardens and at the Ink Mere. The last line changes what the ending means.</td></tr>
          <tr><td>Darker, ominous</td><td>Sad but cosy, comforting throughout</td><td>Dread from the second knot on. Things in the caves back the words up.</td></tr>
          <tr><td>Unexpected</td><td>The ending was the one the first line promised</td><td>The thing you came down to do isn't what you think it is</td></tr>
          <tr><td>Darker with depth</td><td>Roughly the same tone in every area</td><td>Each area is grimmer than the one above. Near the bottom the voice itself goes wrong.</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>How the dark builds</h2>
  <div class="col">
    <p>A spoiler-free outline of the arc, area by area:</p>
    <div class="tablebox">
      <table class="windows">
        <thead><tr><th>Area</th><th>Tone</th><th class="n">Things left in the dark</th></tr></thead>
        <tbody>
          <tr><td>The Brink</td><td>Tender, slightly too insistent</td><td class="n">0</td></tr>
          <tr><td>The Throat</td><td>Dread: something is named</td><td class="n">2</td></tr>
          <tr><td>The Root Gardens</td><td>First turn, cold</td><td class="n">2</td></tr>
          <tr><td>The Bell Gallery</td><td>Grim history</td><td class="n">2</td></tr>
          <tr><td>The Ink Mere</td><td>Second turn: a confession</td><td class="n">2</td></tr>
          <tr><td>Down to the Loom</td><td>Wrong: her voice, not her words</td><td class="n">&mdash;</td></tr>
          <tr><td>The Loom</td><td>The ending, and a last line</td><td class="n">yours</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>What changed in the game</h2>
  <div class="col">
    <ul class="what">
      <li><b>All nine spoken lines</b> (seven knots on her thread, plus the two at the end) are rewritten and re-recorded in the same voice, with new delivery notes that grow colder toward the bottom. Two lines near the end get a second, lower voice mixed under hers.</li>
      <li><b>The six keepsake texts</b> in the hidden rooms are rewritten. Each one is now a piece of the backstory, so players who find the rooms learn more than players who don't.</li>
      <li><b>Eight new things along the route,</b> drawn in the same engraved style as the other props. Each is grimmer than the one before.</li>
      <li><b>Your own deaths now stay down there.</b> Whatever kills the doll, a mark is left where she fell, and it's saved with your progress. The deeper and harder the route, the more of them you'll pass on the way back.</li>
      <li><b>The ending scene</b> plays out differently.</li>
      <li><b>The epilogue film</b> is re-cut from shots that were already rendered. No new Blender renders were needed.</li>
      <li><b>Test runs are now invisible on your PC:</b> the game window used by the test harness is never shown or focused, isn't on the taskbar, and is muted. That rule is now in <code>CLAUDE.md</code>.</li>
    </ul>
  </div>

  <div class="col"><details class="seal">
    <summary>The plot &middot; spoilers<span>Open only when you want to know. Everything below gives the story away.</span></summary>
    <div class="inner">
      <h3>What's really going on</h3>
      <p>Every long winter the dark at the bottom of the old village well calls one name up the shaft, and whoever is called goes down to the Loom and is woven in. The village tried everything: the windlass, miners digging down to kill it, a chapel of bells, a ferry across the ink. Only the cottage is left now, and this winter it called her.</p>
      <ul class="what">
        <li><b>First turn: you are not the first.</b> She has been making dolls and sending them down. Eight lie along the route, grimmer the deeper you go. “You're stronger than the others were.” “They were only practice.”</li>
        <li><b>Second turn: she was made too.</b> At the Ink Mere she confesses that the ink made her forget it for seventy winters. Seventy winters ago the old woman who lived in the cottage was called. She made a doll, the doll followed her down, tied the threads, and went home to sit in her chair. That doll is the knitter.</li>
        <li><b>The voice goes wrong.</b> The last knot before the Loom speaks in her voice, with words that aren't hers and a lower voice underneath. Her chair at the bottom is empty, with her candle still burning beside it.</li>
        <li><b>The rescue is the trap.</b> Tying the threads, the thing you came all this way to do, is the ritual. Her candle goes out, the red runs up her grey thread to the cottage window, and her last line lands. The doll goes home to become the next knitter.</li>
      </ul>
      <h3>Every line, in order</h3>
      <div class="tablebox"><table class="windows"><thead><tr><th>Where</th><th>Her voice</th></tr></thead><tbody>
{lines_rows}
      </tbody></table></div>
      <h3>The keepsakes</h3>
      <div class="tablebox"><table class="windows"><thead><tr><th>Room</th><th>Text</th></tr></thead><tbody>
{keep_rows}
      </tbody></table></div>
      <h3>The ones before you</h3>
      <p>Each slider shows the same spot before and after. The remains are drawn like the rest of the deep, so they only really show inside the thread's light.</p>
{sliders}    </div>
  </details></div>

  <h2>How it was checked</h2>
  <div class="col">
    <ul class="what">
      <li><b>Voice:</b> four takes of each line were recorded, and each take was scored by speech recognition against the script. The best take of each line ships.</li>
      <li><b>In the game, in a hidden window:</b> dying on thorns leaves a mark on the floor below, dying in the ink leaves one floating on its surface, and both survive a save and reload. The ending scene runs from start to finish with no errors.</li>
      <li><b>The remains</b> sit on real floor along the main route. They are scenery only: nothing collides with them, so the route and every jump are unchanged.</li>
      <li><b>The epilogue</b> was re-encoded (47.6 s) and checked with stills pulled from around the new cut.</li>
    </ul>
    <p style="margin-top:16px">Not checked:</p>
    <ul class="what open">
      <li>How the new lines sound to a human ear. They were scored for accuracy, not for chill. Any line can be re-recorded on its own with <code>record.py &lt;id&gt;</code> and <code>pick.py</code>.</li>
    </ul>
    <div class="files">
      <div><b><code>app/src/level.js</code></b><span>The new lines and keepsake texts.</span></div>
      <div><b><code>app/src/props.js</code></b><span>The eight new props along the route, and the marks your deaths leave.</span></div>
      <div><b><code>app/src/world.js</code> &middot; <code>main.js</code> &middot; <code>draw.js</code></b><span>Marks left where the doll dies, saved with your progress; the changed ending.</span></div>
      <div><b><code>scripts/voice/</code></b><span>New script and delivery notes; the second voice under two lines.</span></div>
      <div><b><code>scripts/cine/edit.py</code></b><span>The epilogue re-cut.</span></div>
      <div><b><code>docs/STORY.md</code></b><span>The full plot and the area-by-area escalation map, for future changes (spoilers).</span></div>
      <div><b><code>electron/main.js</code> &middot; <code>CLAUDE.md</code></b><span>Test runs never show a window or play sound.</span></div>
    </div>
  </div>
'''
print(page('story', 'Spindledeep · A Darker Thread', body, PREV))
