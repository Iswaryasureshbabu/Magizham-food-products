"""
UI smoke test (optional): needs  pip install playwright && playwright install chromium
Run from the project root:  python tests/ui_smoke.py
It serves the static files itself and blocks the API + CDNs, so the pages use the
bundled catalogue. It checks every page at 4 widths in English and Tamil for:
JS errors, horizontal overflow, broken images and uneven card widths.
Tamil glyph rendering depends on the Tamil font installed on the machine running it.
"""
import http.server, socketserver, threading, os, sys, functools
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PAGES = ['index.html', 'login.html', 'register.html', 'cart.html', 'checkout.html', 'orders.html'] + \
        [f'category.html?type={t}' for t in ['podi', 'soup', 'kanji', 'pickles', 'kulambu', 'malt']]
WIDTHS = [1440, 1024, 768, 390]
LANGS = {'English': 'English', 'Tamil': '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd'}

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass

handler = functools.partial(QuietHandler, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', 0), handler)   # 0 = any free port
PORT = httpd.server_address[1]
threading.Thread(target=httpd.serve_forever, daemon=True).start()

failures, checks = [], 0
with sync_playwright() as p:
    b = p.chromium.launch()
    for lname, lval in LANGS.items():
        for w in WIDTHS:
            ctx = b.new_context(viewport={'width': w, 'height': 800})
            pg = ctx.new_page()
            for pat in ['**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**', '**/cdnjs.cloudflare.com/**', '**/api/**']:
                pg.route(pat, lambda r: r.abort())
            errors = []
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html')
            pg.evaluate("v => localStorage.setItem('magizhamLang', v)", lval)
            for page in PAGES:
                errors.clear()
                pg.goto(f'http://127.0.0.1:{PORT}/{page}')
                pg.wait_for_timeout(500)
                pg.evaluate("document.querySelectorAll('*').forEach(e=>{e.style.transition='none'})")
                tag = f'[{lname} {w}px] {page}'
                checks += 4
                if errors: failures.append(f'{tag}: JS errors {errors[:2]}')
                over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if over > 1: failures.append(f'{tag}: horizontal overflow of {over}px')
                broken = pg.evaluate("[...document.images].filter(i=>i.complete && i.naturalWidth===0 && i.src && !i.src.endsWith('/')).map(i=>i.getAttribute('src'))")
                if broken: failures.append(f'{tag}: broken images {broken[:3]}')
                # cards in one grid column must share a width
                uneven = pg.evaluate("""() => { const c=[...document.querySelectorAll('.product, .category-grid .card')];
                    if(c.length<2) return 0; const ws=c.map(e=>Math.round(e.getBoundingClientRect().width));
                    return Math.max(...ws)-Math.min(...ws); }""")
                if uneven > 2: failures.append(f'{tag}: card widths differ by {uneven}px')
            ctx.close()
    b.close()
httpd.shutdown()
print(f'{checks} checks run, {len(failures)} failure(s)')
for f in failures: print('FAIL', f)
sys.exit(1 if failures else 0)
