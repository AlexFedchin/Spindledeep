"""Source fetching for the sound build: Freesound CC0 previews by id, Kevin MacLeod (CC BY 4.0) by title."""
import html
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
UA = {'User-Agent': 'Mozilla/5.0 (sound-build)'}
try:
    import truststore  # the antivirus on the dev machine intercepts HTTPS
    truststore.inject_into_ssl()
    _CTX = None
except Exception:
    _CTX = ssl.create_default_context()
    _CTX.check_hostname = False
    _CTX.verify_mode = ssl.CERT_NONE


def _get(url, binary=False):
    for k in range(6):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60, context=_CTX)
            d = r.read()
            return (d if binary else d.decode('utf8', 'replace')), r.geturl()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(6 + 6 * k)
                continue
            raise
    raise RuntimeError('rate limited: ' + url)


_meta = None


def meta():
    global _meta
    if _meta is None:
        p = os.path.join(CACHE, 'fs', 'meta.json')
        _meta = json.load(open(p, encoding='utf8')) if os.path.exists(p) else {}
    return _meta


def fs(sid):
    """Local path of a Freesound sound (HQ preview), downloading it if needed. Refuses non-CC0."""
    sid = str(sid)
    path = os.path.join(CACHE, 'fs', sid + '.mp3')
    m = meta()
    if os.path.exists(path) and sid in m:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    page, final = _get(f'https://freesound.org/s/{sid}/')
    mp3 = re.search(r'data-mp3="([^"]+)"', page).group(1).replace('-lq.mp3', '-hq.mp3')
    lic = re.search(r'href="(https?://creativecommons\.org/[^"]+)"', page)
    m[sid] = {
        'title': html.unescape(re.search(r'data-title="([^"]*)"', page).group(1)),
        'user': re.search(r'/people/([^/]+)/sounds/', final).group(1),
        'license': lic.group(1) if lic else '?',
        'url': final,
    }
    if 'publicdomain/zero' not in m[sid]['license']:
        raise RuntimeError(f'freesound {sid} is not CC0: {m[sid]["license"]}')
    data, _ = _get(mp3, binary=True)
    open(path, 'wb').write(data)
    json.dump(m, open(os.path.join(CACHE, 'fs', 'meta.json'), 'w', encoding='utf8'), indent=1, ensure_ascii=False)
    time.sleep(1.2)
    return path


def km(title):
    """Local path of a Kevin MacLeod track (incompetech.com, CC BY 4.0)."""
    path = os.path.join(CACHE, 'music', title + '.mp3')
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data, _ = _get('https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + urllib.parse.quote(title + '.mp3'), binary=True)
        open(path, 'wb').write(data)
    return path
