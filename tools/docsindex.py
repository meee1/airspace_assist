"""Search index for the help pages (app/docs/*.html) -> app/docs/search.json.

One entry per section: the page (file, h1 title), the section (h2/h3 text and the id to link to: the heading's own id, else
the h2 above it, else the top of the page) and its text (paragraphs, lists, tables; not the top bar, the contents lists or
the previous/next links). Run by assemble.py on every build, or on its own: python3 tools/docsindex.py
"""
import json, os, re, sys
from html.parser import HTMLParser

VOID = {'br', 'img', 'input', 'meta', 'link', 'hr', 'wbr', 'source'}
SKIP_TAG = {'header', 'nav', 'script', 'style', 'form', 'button'}
SKIP_CLS = re.compile(r'\b(toc-in|toc|pager)\b')
BREAK = {'p', 'li', 'td', 'th', 'div', 'tr', 'dd', 'dt', 'h4', 'table', 'ul', 'ol', 'br'}

class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, skipping)]
        self.title = ''; self.secs = []; self.cur = None; self.h2id = ''
        self.mode = None; self.buf = []; self.hid = ''
    def skipping(self): return bool(self.stack) and self.stack[-1][1]
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); sk = self.skipping() or tag in SKIP_TAG or bool(SKIP_CLS.search(a.get('class') or ''))
        if tag not in VOID: self.stack.append((tag, sk))
        if sk: return
        if tag == 'h1': self.mode = 'h1'; self.buf = []
        elif tag in ('h2', 'h3'): self.mode = tag; self.buf = []; self.hid = a.get('id') or ''
        elif tag in BREAK: self._add(' ')
    def handle_endtag(self, tag):
        sk = self.skipping()
        if tag in VOID: return
        while self.stack:   # pop to the matching tag (tolerates unclosed <p>/<li>)
            t, _ = self.stack.pop()
            if t == tag: break
        if sk: return
        if tag == 'h1' and self.mode == 'h1':
            self.title = ' '.join(''.join(self.buf).split()); self.mode = None
            self.cur = {'s': '', 'id': '', 't': []}; self.secs.append(self.cur)
        elif tag in ('h2', 'h3') and self.mode == tag:
            text = ' '.join(''.join(self.buf).split()); self.mode = None
            if tag == 'h2': self.h2id = self.hid
            self.cur = {'s': text, 'id': self.hid or self.h2id, 't': []}; self.secs.append(self.cur)
        elif tag in BREAK: self._add(' ')
    def handle_data(self, data):
        if self.skipping(): return
        if self.mode: self.buf.append(data); return
        self._add(data)
    def _add(self, s):
        if self.cur is not None: self.cur['t'].append(s)

def build(docs_dir):
    out = []
    for f in sorted(os.listdir(docs_dir)):
        if not f.endswith('.html'): continue
        d = Doc(); d.feed(open(os.path.join(docs_dir, f), encoding='utf-8').read())
        for s in d.secs:
            t = ' '.join(''.join(s['t']).split())
            if not t and not s['s']: continue
            out.append({'p': f, 'pt': d.title, 's': s['s'], 'id': s['id'], 't': t})
    path = os.path.join(docs_dir, 'search.json')
    js = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    if not os.path.exists(path) or open(path, encoding='utf-8').read() != js:
        open(path, 'w', encoding='utf-8', newline='').write(js)
    return len(out), len(js)

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    n, b = build(sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, '..', 'app', 'docs'))
    print('help search index:', n, 'sections,', b // 1024, 'KB')
