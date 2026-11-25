"""The trailer, to watch (`trailer/`; the videos are not in git)."""
from mkpage import page, hero

PREV = ' &middot; <a href="https://claude.ai/artifact/2MbbE57vopQ11jGfd8ZGi4">drawn</a>'
CSS = '''  <style>
    .screen { max-width: 1280px; margin: 34px auto 18px; }
    .screen video { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; height: auto; background: #000; border: 1px solid var(--rule); }
    .screen video:focus-visible { outline: 2px solid var(--red); outline-offset: 4px; }
    .screen p { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--paper-dim); margin: 12px 0 0; }
  </style>'''
body = CSS + hero('trailer', 'Spindledeep', 'a descent', 'on a single red thread') + '''
  <div class="screen">
    <video id="trailer" controls playsinline preload="metadata" poster="img/poster.jpg">
      <source src="vid/trailer_1080.mp4" type='video/mp4; codecs="av01.0.08M.08, mp4a.40.2"'>
      <source src="vid/trailer_720.mp4" type='video/mp4; codecs="avc1.640032, mp4a.40.2"'>
    </video>
    <p>67 seconds &middot; with sound &middot; recorded from the game</p>
  </div>
  <div class="col">
    <p>Music: Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0.</p>
  </div>
'''
print(page('trailer', 'Spindledeep Trailer', body, PREV))
