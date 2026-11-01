"""Advanced SSRF lab: filter bypass via hostname alias."""
import os
import json
import urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')

INTERNAL = {
    '/vault': {'flag': FLAG_1, 'description': 'Secret vault - internal only'},
    '/admin-api': {'flag': FLAG_2, 'description': 'Admin API - internal only'},
}

BLOCKED = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '169.254']


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/fetch':
            self.handle_fetch(params)
        elif path.startswith('/internal'):
            # Direct access to internal endpoints (for testing)
            internal_path = path.replace('/internal', '') or '/'
            if internal_path in INTERNAL:
                self.send_json(INTERNAL[internal_path])
            else:
                self.send_json({'error': 'not found', 'available': list(INTERNAL.keys())}, 404)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_fetch(self, params):
        url = params.get('url', [''])[0]
        if not url:
            self.send_html(FETCH_FORM)
            return

        parsed = urlparse(url)
        hostname = parsed.hostname or ''

        # Check if blocked
        is_blocked = any(b in hostname for b in BLOCKED)

        if is_blocked:
            self.send_html(FETCH_BLOCKED.format(
                url=url,
                hint='Direct localhost blocked. The filter checks the HOSTNAME... '
                     'but not DNS aliases. Try: http://ssrf-alias:8080/internal/vault'))
            return

        # Simulate fetching: any non-blocked hostname that maps to this server works
        # The Docker network has an alias "ssrf-alias" that resolves to this container
        try:
            # Route to internal endpoints regardless of hostname (if path matches)
            internal_path = parsed.path.replace('/internal', '') or '/'
            if internal_path in INTERNAL:
                self.send_html(FETCH_RESULT.format(
                    url=url, content=json.dumps(INTERNAL[internal_path], indent=2)))
            else:
                self.send_html(FETCH_RESULT.format(
                    url=url, content='{"message": "reached server", "path": "%s"}' % parsed.path))
        except Exception as e:
            self.send_html(FETCH_ERROR.format(url=url, error=str(e)), 500)

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>SSRF Advanced Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔗 SSRF Advanced Lab</h1>
<p>URL Fetcher with a FILTER that blocks localhost. Bypass it with a DNS alias.</p>
<ul>
<li><a href="/fetch" style="color:#58a6ff">/fetch</a> — Fetch with filter</li>
<li><a href="/internal/vault" style="color:#58a6ff">/internal/vault</a> — Direct (works but teaches the path)</li>
</ul>
<p style="color:#d29922;font-size:12px">Filter blocks: localhost, 127.0.0.1, 0.0.0.0, [::1], 169.254<br>
Hint: the Docker network has an alias <code>ssrf-alias</code> that resolves to this server.</p>
</body></html>"""

FETCH_FORM = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Fetch URL</h1>
<form action="/fetch" method="GET">
<input name="url" placeholder="http://..." size="50" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Fetch</button>
</form>
</body></html>"""

FETCH_BLOCKED = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#d29922">
<h1>🚫 Blocked</h1>
<p>URL: {url}</p>
<p style="color:#58a6ff;font-size:12px">{hint}</p>
</body></html>"""

FETCH_RESULT = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Fetch Result</h1>
<p>URL: <code style="color:#58a6ff">{url}</code></p>
<pre style="background:#161b22;padding:20px;border-radius:8px;overflow-x:auto;white-space:pre-wrap">{content}</pre>
</body></html>"""

FETCH_ERROR = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>Fetch Failed</h1><p>URL: {url}</p><pre>{error}</pre>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'SSRF deep lab on :8080')
    server.serve_forever()
