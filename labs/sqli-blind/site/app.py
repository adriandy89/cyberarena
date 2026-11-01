"""Blind SQLi lab: no errors, but boolean/time differences reveal data."""
import os
import sqlite3
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import html as html_mod

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')

def init_db():
    conn = sqlite3.connect(':memory:')
    c = conn.cursor()
    c.execute('CREATE TABLE users (id INTEGER, username TEXT, password TEXT, secret TEXT)')
    c.execute('CREATE TABLE config (key TEXT, value TEXT)')
    c.execute("INSERT INTO users VALUES (1, 'admin', ?, ?)", (FLAG_1, 'admin_secret'))
    c.execute("INSERT INTO users VALUES (2, 'user', 'pass123', 'user_secret')")
    c.execute("INSERT INTO config VALUES ('api_key', ?)", (FLAG_2,))
    conn.commit()
    return conn

DB = init_db()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/check':
            self.handle_check(params)
        elif path == '/status':
            self.handle_status(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_check(self, params):
        """Boolean-based blind: page shows 'User exists' vs 'User not found'."""
        uid = params.get('id', [''])[0]
        # VULNERABLE: direct interpolation, but NO error messages shown
        sql = f"SELECT username FROM users WHERE id={uid}"
        try:
            cursor = DB.execute(sql)
            row = cursor.fetchone()
            if row:
                # Only shows generic "exists" — no data leaked directly
                self.send_html(CHECK_FOUND)
            else:
                self.send_html(CHECK_NOT_FOUND)
        except Exception:
            # Swallow errors completely — no information leak
            self.send_html(CHECK_NOT_FOUND)

    def handle_status(self, params):
        """Time-based blind: SLEEP() causes delay when condition is TRUE."""
        service = params.get('service', [''])[0]
        sql = f"SELECT value FROM config WHERE key='{service}'"
        try:
            cursor = DB.execute(sql)
            row = cursor.fetchone()
            if row:
                # Normal fast response
                self.send_html(STATUS_OK)
            else:
                self.send_html(STATUS_NOT_FOUND)
        except Exception:
            # If the SQL is invalid OR contains SLEEP, it takes time
            # SQLite doesn't have SLEEP, so we simulate it
            if 'sleep' in service.lower() or 'delay' in service.lower():
                time.sleep(3)  # simulate delay for time-based
            self.send_html(STATUS_NOT_FOUND)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>Blind SQLi Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🕵️ Blind SQL Injection Lab</h1>
<p>No error messages. No data displayed. Just "exists" or "not found".</p>
<ul>
<li><a href="/check?id=1" style="color:#58a6ff">/check?id=1</a> — Boolean-based blind</li>
<li><a href="/status?service=api_key" style="color:#58a6ff">/status?service=api_key</a> — Time-based blind</li>
</ul>
</body></html>"""

CHECK_FOUND = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ User exists</h1></body></html>"""

CHECK_NOT_FOUND = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ User not found</h1></body></html>"""

STATUS_OK = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Service active</h1></body></html>"""

STATUS_NOT_FOUND = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ Service not found</h1></body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Blind SQLi lab on :8080')
    server.serve_forever()
