"""Build a Spindledeep changes page from _template.html: keeps the template's <head>/style and script,
swaps the title and the body. Usage from another script:  from mkpage import page, reveal; page(slug, title, body)"""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
FOOT = ('  <footer>Earlier pages: <a href="https://claude.ai/artifact/X7CAu6EX2KnXzAq5mpNZbz">the original write-up</a>'
        ' &middot; <a href="https://claude.ai/artifact/75LuG1uAroYU4dzHWNbkHc">the polish pass</a>{extra}</footer>\n')

def reveal(rid, before, after, alt_b, alt_a, lb='Before', la='After'):
    return f'''    <div class="reveal">
      <img src="img/{before}" alt="{alt_b}">
      <img class="after" src="img/{after}" alt="{alt_a}">
      <span class="lbl l">{lb}</span><span class="lbl r">{la}</span>
      <div class="bar" aria-hidden="true"></div>
      <input type="range" id="rv-{rid}" min="0" max="100" value="50" step="0.5" aria-label="Drag to compare {lb.lower()} and {la.lower()}">
    </div>
    <p class="reveal-cap">Drag the thread to compare</p>
'''

def hero(eyebrow, h1, tag_a, tag_b):
    return f'''  <header class="hero">
    <div class="eyebrow">Spindledeep &middot; {eyebrow}</div>
    <h1>{h1}</h1>
    <p class="tag">{tag_a}<span></span>{tag_b}</p>
  </header>
'''

def page(slug, title, body, extra_links=''):
    tpl = open(os.path.join(HERE, '_template.html'), encoding='utf-8').read()
    head = tpl[:tpl.index('<div class="wrap">')].replace('Spindledeep PAGE NAME', title)
    script = tpl[tpl.index('<script>'):]
    out = os.path.join(HERE, slug, 'index.html')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(head + '<div class="wrap">\n' + body + FOOT.format(extra=extra_links) + '</div>\n' + script)
    return out
