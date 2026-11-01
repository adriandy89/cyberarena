"""Login form for brute force practice — Python stdlib only."""
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')

# Weak password from rockyou.txt (top 100)
USERS = {
    'admin': {'password': 'summer2014', 'flag': FLAG_1},
    'guest': {'password': 'guest', 'flag': None},
    'svc_backup': {'password': 'changeme', 'flag': FLAG_2},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/':
            self.send_html(LOGIN_FORM)
        elif path == '/login':
            params = parse_qs(parsed.query)
            username = params.get('username', [''])[0]
            password = params.get('password', [''])[0]
            self.check_login(username, password)
        else:
            self.send_html(NOT_FOUND, 404)

    def check_login(self, username, password):
        user = USERS.get(username)
        if user and user['password'] == password:
            if user['flag']:
                self.send_html(LOGIN_OK.format(user=username, flag=user['flag']))
            else:
                self.send_html(LOGIN_NO_FLAG.format(user=username))
        else:
            self.send_html(LOGIN_FAIL, 401)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


LOGIN_FORM = """<!DOCTYPE html>
<html><head><title>Login</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔐 Admin Login</h1>
<form action="/login" method="GET">
<input name="username" placeholder="Username" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<input name="password" placeholder="Password" type="password" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Login</button>
</form>
<p style="color:#8b949e;font-size:12px">Hydra command for GET form:
hydra -l admin -P rockyou.txt 127.0.0.1 http-get-form "/login:username=^USER^&password=^PASS^:incorrect"</p>
</body></html>"""

LOGIN_OK = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Welcome {user}!</h1>
<p>Flag: <b>{flag}</b></p>
</body></html>"""

LOGIN_NO_FLAG = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#d29922">
<h1>⚠️ Welcome {user}</h1>
<p>You logged in, but this account has no flag. Try a different user...</p>
</body></html>"""

LOGIN_FAIL = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ Login Failed</h1><p>incorrect</p></body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Hydra target on :8080')
    server.serve_forever()
