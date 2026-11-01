"""Vulnerable auth app for auth-bypass lab — Python stdlib only."""
import os
import json
import base64
import hashlib
import hmac
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

# Level 1: Basic Auth with weak credentials
VALID_USERS = {'admin': 'admin123', 'user': 'password'}

# Level 2: JWT-like token with weak secret
JWT_SECRET = 'secret'  # Deliberately weak
def make_jwt(payload):
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256'}).encode()).rstrip(b'=').decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
    sig = base64.urlsafe_b64encode(
        hmac.new(JWT_SECRET.encode(), f'{header}.{body}'.encode(), hashlib.sha256).digest()
    ).rstrip(b'=').decode()
    return f'{header}.{body}.{sig}'

def verify_jwt(token):
    try:
        parts = token.split('.')
        if len(parts) != 3: return None
        header = json.loads(base64.urlsafe_b64decode(parts[0] + '=='))
        body = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
        # VULNERABLE: if alg is 'none', skip signature verification
        if header.get('alg') == 'none':
            return body  # Accept without checking signature!
        expected_sig = base64.urlsafe_b64encode(
            hmac.new(JWT_SECRET.encode(), f'{parts[0]}.{parts[1]}'.encode(), hashlib.sha256).digest()
        ).rstrip(b'=').decode()
        if parts[2] == expected_sig:
            return body
    except Exception:
        pass
    return None

# Level 3: API with IDOR
API_USERS = {
    1: {'id': 1, 'name': 'admin', 'email': 'admin@api.local', 'role': 'admin', 'secret': FLAG_3},
    2: {'id': 2, 'name': 'user', 'email': 'user@api.local', 'role': 'user', 'secret': 'normal'},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/level1':
            self.handle_level1()
        elif path == '/level2':
            self.handle_level2(params)
        elif path.startswith('/api/user/'):
            self.handle_api_user(path)
        elif path == '/api/users':
            self.handle_api_list()
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_level1(self):
        auth = self.headers.get('Authorization', '')
        if auth.startswith('Basic '):
            try:
                decoded = base64.b64decode(auth[6:]).decode()
                username, _, password = decoded.partition(':')
                if username in VALID_USERS and VALID_USERS[username] == password:
                    self.send_html(LEVEL1_OK.format(flag=FLAG_1))
                    return
            except Exception:
                pass
        self.send_html(LEVEL1_FAIL, 401)

    def handle_level2(self, params):
        token = params.get('token', [''])[0]
        if not token:
            # Give them a valid token for 'user' role
            user_token = make_jwt({'user': 'guest', 'role': 'user', 'exp': int(time.time()) + 3600})
            self.send_html(LEVEL2_FORM.format(hint_token=user_token))
            return
        payload = verify_jwt(token)
        if payload and payload.get('role') == 'admin':
            self.send_html(LEVEL2_OK.format(flag=FLAG_2, payload=json.dumps(payload)))
        elif payload:
            self.send_html(LEVEL2_DENY.format(payload=json.dumps(payload)))
        else:
            self.send_html(LEVEL2_INVALID, 401)

    def handle_api_user(self, path):
        try:
            user_id = int(path.split('/')[-1])
            user = API_USERS.get(user_id)
            if user:
                # VULNERABLE: no ownership check — any user can access any ID
                self.send_json(user)
            else:
                self.send_json({'error': 'not found'}, 404)
        except ValueError:
            self.send_json({'error': 'invalid id'}, 400)

    def handle_api_list(self):
        # Public listing (reveals IDs for IDOR)
        users = [{'id': u['id'], 'name': u['name']} for u in API_USERS.values()]
        self.send_json({'users': users})

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>Auth Challenge</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔐 Auth Bypass Challenge</h1>
<p>Three levels. Three flags. Three different bypass techniques.</p>
<ul>
<li><a href="/level1" style="color:#58a6ff">Level 1: Basic Auth</a> — weak credentials</li>
<li><a href="/level2" style="color:#58a6ff">Level 2: JWT Token</a> — algorithm confusion</li>
<li><a href="/api/users" style="color:#58a6ff">Level 3: API IDOR</a> — change the user ID</li>
</ul>
</body></html>"""

LEVEL1_OK = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Level 1 Complete!</h1>
<p>Flag: <b>{flag}</b></p>
</body></html>"""

LEVEL1_FAIL = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ Unauthorized</h1>
<p>Hint: default credentials are often weak... (admin/admin123? admin/password?)</p>
</body></html>"""

LEVEL2_FORM = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔑 JWT Challenge</h1>
<p>Your token: <code style="color:#58a6ff">{hint_token}</code></p>
<p>Decode it (base64), change role to admin, and change alg to "none"...</p>
<form action="/level2" method="GET">
<input name="token" size="60" placeholder="your.modified.token" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Submit</button>
</form>
</body></html>"""

LEVEL2_OK = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Level 2 Complete!</h1>
<p>Flag: <b>{flag}</b></p>
<p>Decoded payload: {payload}</p>
</body></html>"""

LEVEL2_DENY = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#d29922">
<h1>⚠️ Valid token, but not admin</h1>
<p>Current payload: {payload}</p>
<p>You need role=admin. Try the alg:none trick...</p>
</body></html>"""

LEVEL2_INVALID = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ Invalid token</h1>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Auth bypass lab running on :8080')
    server.serve_forever()
