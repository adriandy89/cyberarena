"""Vulnerable web app for the xss-reflejado lab — Python stdlib only."""
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import html as html_mod

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{placeholder}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{placeholder}')

# In-memory "database" for stored XSS (guestbook)
guestbook = [
    {'name': 'Alice', 'message': 'Great site!'},
    {'name': 'Bob', 'message': 'Hello everyone!'},
    # This one has the flag hidden in a way that XSS can reveal
    {'name': 'admin', 'message': f'Internal note: secret is {FLAG_2}'},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/hello':
            self.handle_hello(params)
        elif path == '/guestbook':
            self.handle_guestbook()
        elif path == '/post':
            self.handle_post(params)
        elif path == '/search':
            self.handle_search(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_hello(self, params):
        name = params.get('name', ['World'])[0]
        # VULNERABLE: reflected WITHOUT any encoding
        # (html_mod.escape(name) would fix it — deliberately not used)
        self.send_html(HELLO_PAGE.format(name=name))

    def handle_guestbook(self):
        entries = ''.join(
            f'<div class="entry"><b>{e["name"]}:</b> {e["message"]}</div>'
            for e in guestbook
        )
        self.send_html(GUESTBOOK.format(entries=entries))

    def handle_post(self, params):
        name = params.get('name', [''])[0]
        message = params.get('message', [''])[0]
        if name and message:
            # VULNERABLE: stored without sanitization
            guestbook.append({'name': name, 'message': message})
            self.send_html(POST_OK.format(name=name))
        else:
            self.send_html(POST_ERROR, 400)

    def handle_search(self, params):
        query = params.get('q', [''])[0]
        # VULNERABLE: reflected in the "no results" message
        self.send_html(SEARCH.format(query=query, flag_hint=FLAG_1 if 'XSS' in query else ''))

    def send_html(self, content, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(content.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>XSS Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🎯 XSS Playground</h1>
<ul>
<li><a href="/hello?name=World" style="color:#58a6ff">/hello?name=World</a> — Reflected XSS</li>
<li><a href="/guestbook" style="color:#58a6ff">/guestbook</a> — Stored XSS (post something!)</li>
<li><a href="/search?q=test" style="color:#58a6ff">/search?q=test</a> — Search (reflected in error)</li>
</ul>
</body></html>"""

HELLO_PAGE = """<!DOCTYPE html>
<html><head><title>Hello</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Hello, {name}!</h1>
<p>Your input was reflected WITHOUT any encoding.</p>
<a href="/" style="color:#58a6ff">&larr; Back</a>
</body></html>"""

GUESTBOOK = """<!DOCTYPE html>
<html><head><title>Guestbook</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>📖 Guestbook</h1>
{entries}
<br><hr>
<h3>Post a message:</h3>
<form action="/post" method="GET">
<input name="name" placeholder="Name" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<input name="message" placeholder="Message" size="40" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Post</button>
</form>
<a href="/" style="color:#58a6ff">&larr; Back</a>
</body></html>"""

POST_OK = """<!DOCTYPE html>
<html><head><title>Posted!</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Posted!</h1>
<p>Message from <b>{name}</b> added. <a href="/guestbook" style="color:#58a6ff">View guestbook</a></p>
</body></html>"""

POST_ERROR = """<html><body><h1>400 Bad Request</h1><p>Name and message required.</p></body></html>"""

SEARCH = """<!DOCTYPE html>
<html><head><title>Search</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Search Results</h1>
<p>No results found for: <b>{query}</b></p>
<p style="color:#8b949e;font-size:12px">Try searching for 'XSS' for a surprise...{flag_hint}</p>
<a href="/" style="color:#58a6ff">&larr; Back</a>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'XSS lab running on :8080')
    server.serve_forever()
