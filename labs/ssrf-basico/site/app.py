"""Vulnerable web app for the ssrf-basico lab — Python stdlib only."""
import os
import urllib.request
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{placeholder}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{placeholder}')


class InternalAPI:
    """Simulates an internal service that should never be exposed publicly."""
    @staticmethod
    def get(path):
        if path == '/health':
            return {'status': 'ok', 'service': 'internal-api', 'version': '2.1.0'}
        elif path == '/users':
            return {'users': [
                {'id': 1, 'name': 'admin', 'role': 'superuser'},
                {'id': 2, 'name': 'ana', 'role': 'user'},
            ]}
        elif path == '/config':
            return {
                'database_host': '10.0.0.100',
                'database_port': 5432,
                'api_secret': FLAG_2,
                'debug': True,
                'flag': FLAG_1,
            }
        elif path == '/metadata':
            # Simulates cloud metadata endpoint (like AWS 169.254.169.254)
            return {
                'instance-id': 'i-0abc123def456',
                'region': 'us-east-1',
                'iam-role': 'arn:aws:iam::123456789:role/app-server',
                'credentials': {'access_key': 'AKIAIOSFODNN7EXAMPLE', 'flag': FLAG_2},
            }
        return {'error': 'not found'}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/fetch':
            self.handle_fetch(params)
        elif path == '/internal':
            self.handle_internal(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_fetch(self, params):
        url = params.get('url', [''])[0]
        if not url:
            self.send_html(FETCH_FORM)
            return

        # VULNERABLE: fetches ANY URL the user provides, including internal
        try:
            if url.startswith('http://localhost') or url.startswith('http://127.0.0.1'):
                # Simulate internal request — parse the FULL URL including query
                parsed_internal = urlparse(url)
                internal_path = parsed_internal.path or '/'
                internal_params = parse_qs(parsed_internal.query)

                # Route to InternalAPI based on the path
                if internal_path == '/internal':
                    # The /internal endpoint itself has a ?path= query param
                    api_path = internal_params.get('path', ['/health'])[0]
                    data = InternalAPI.get(api_path)
                else:
                    data = InternalAPI.get(internal_path)
                self.send_html(FETCH_RESULT.format(
                    url=url, status=200, content=json.dumps(data, indent=2)))
            elif url.startswith('http://169.254'):
                # Simulate cloud metadata
                data = InternalAPI.get('/metadata')
                self.send_html(FETCH_RESULT.format(
                    url=url, status=200, content=json.dumps(data, indent=2)))
            else:
                # Actually fetch external URLs (for demo)
                req = urllib.request.Request(url, method='GET')
                resp = urllib.request.urlopen(req, timeout=5)
                content = resp.read(4096).decode('utf-8', errors='replace')
                self.send_html(FETCH_RESULT.format(
                    url=url, status=resp.status, content=content[:2000]))
        except Exception as e:
            self.send_html(FETCH_ERROR.format(url=url, error=str(e)), 500)

    def handle_internal(self, params):
        # This endpoint exists on the "internal" network — not supposed to be reachable
        path = params.get('path', ['/health'])[0]
        data = InternalAPI.get(path)
        self.send_json(data)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>URL Fetcher</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔗 URL Fetcher Service</h1>
<p>Enter a URL and we'll fetch it for you! (Like a URL preview service)</p>
<ul>
<li><a href="/fetch" style="color:#58a6ff">/fetch</a> — Fetch any URL</li>
</ul>
<p style="color:#8b949e;font-size:12px">Try: http://localhost:8080/internal?path=/health</p>
</body></html>"""

FETCH_FORM = """<!DOCTYPE html>
<html><head><title>Fetch URL</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔗 Fetch a URL</h1>
<form action="/fetch" method="GET">
<input name="url" placeholder="http://..." size="50" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Fetch</button>
</form>
</body></html>"""

FETCH_RESULT = """<!DOCTYPE html>
<html><head><title>Result</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Fetch Result</h1>
<p>URL: <code style="color:#58a6ff">{url}</code> (Status: {status})</p>
<pre style="background:#161b22;padding:20px;border-radius:8px;overflow-x:auto;white-space:pre-wrap">{content}</pre>
<a href="/fetch" style="color:#58a6ff">&larr; Fetch another</a>
</body></html>"""

FETCH_ERROR = """<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>Fetch Failed</h1>
<p>URL: {url}</p>
<pre style="background:#161b22;padding:20px;border-radius:8px">{error}</pre>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'SSRF lab running on :8080')
    server.serve_forever()
