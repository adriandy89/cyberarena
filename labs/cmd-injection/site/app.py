"""Vulnerable ping utility for cmd-injection lab — Python stdlib only."""
import os
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import html as html_mod

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{placeholder}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{placeholder}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{placeholder}')

# Plant flags in the filesystem for command injection to discover
os.makedirs('/tmp/flags', exist_ok=True)
with open('/tmp/flags/flag1.txt', 'w') as f: f.write(FLAG_1)
with open('/etc/flag2_hidden', 'w') as f: f.write(FLAG_2)
with open('/tmp/flags/flag3_filtered.txt', 'w') as f: f.write(FLAG_3)


def ping_host(host):
    """VULNERABLE: passes user input directly to shell command."""
    try:
        result = subprocess.run(
            f'ping -c 1 -W 2 {host}',
            shell=True, capture_output=True, text=True, timeout=5
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return 'Ping timeout'


def ping_host_filtered(host):
    """Attempted filter: blocks ; && || — but bypassable."""
    blocked = [';', '&&', '||', '`', '$(']
    for char in blocked:
        if char in host:
            return f'Error: character "{char}" is not allowed'
    try:
        result = subprocess.run(
            f'ping -c 1 -W 2 {host}',
            shell=True, capture_output=True, text=True, timeout=5
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return 'Ping timeout'


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/ping':
            host = params.get('host', [''])[0]
            output = ping_host(host)
            self.send_html(PING_PAGE.format(host=html_mod.escape(host), output=html_mod.escape(output)))
        elif path == '/secure-ping':
            host = params.get('host', [''])[0]
            output = ping_host_filtered(host)
            self.send_html(SECURE_PAGE.format(host=html_mod.escape(host), output=html_mod.escape(output)))
        else:
            self.send_html(NOT_FOUND, 404)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>Network Tools</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🌐 Network Tools</h1>
<p>Use our ping utility to check host availability:</p>
<form action="/ping" method="GET">
<input name="host" placeholder="8.8.8.8" size="20" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Ping</button>
</form>
<p><a href="/secure-ping?host=8.8.8.8" style="color:#58a6ff">Secure Ping (with filter)</a></p>
</body></html>"""

PING_PAGE = """<!DOCTYPE html>
<html><head><title>Ping: {host}</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Ping Result: {host}</h1>
<pre style="background:#161b22;padding:20px;border-radius:8px;overflow-x:auto">{output}</pre>
<a href="/" style="color:#58a6ff">&larr; Back</a>
</body></html>"""

SECURE_PAGE = """<!DOCTYPE html>
<html><head><title>Secure Ping: {host}</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔒 Secure Ping: {host}</h1>
<p style="color:#d29922;font-size:12px">Filter active: ; && || ` $() are blocked</p>
<pre style="background:#161b22;padding:20px;border-radius:8px;overflow-x:auto">{output}</pre>
<a href="/" style="color:#58a6ff">&larr; Back</a>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Cmd injection lab running on :8080')
    server.serve_forever()
