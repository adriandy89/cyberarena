"""JWT attack lab: none algorithm, weak secret, algorithm confusion."""
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

WEAK_SECRET = 'jwt_secret'  # Crackable from rockyou.txt
STRONG_SECRET = 'aV3ryL0ngAndR4nd0mS3cr3tK3yTh4tIsN0tE4s1lyCr4ck3d!2024'


def b64url_encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def b64url_decode(data):
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data)


def make_hs256_token(payload, secret):
    header = b64url_encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    body = b64url_encode(json.dumps(payload).encode())
    sig = b64url_encode(hmac.new(secret.encode(), f'{header}.{body}'.encode(), hashlib.sha256).digest())
    return f'{header}.{body}.{sig}'


def verify_token(token):
    """VULNERABLE: accepts alg:none, and uses weak secret for HS256."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None

        header = json.loads(b64url_decode(parts[0]))
        body = json.loads(b64url_decode(parts[1]))

        # VULNERABLE: accepts alg:none without signature verification
        if header.get('alg') == 'none':
            return body  # Signature ignored!

        # VULNERABLE: uses weak secret (crackable)
        if header.get('alg') == 'HS256':
            expected_sig = b64url_encode(
                hmac.new(WEAK_SECRET.encode(), f'{parts[0]}.{parts[1]}'.encode(), hashlib.sha256).digest()
            )
            if parts[2] == expected_sig:
                return body

        return None
    except Exception:
        return None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            # Give a guest token
            guest_token = make_hs256_token({
                'user': 'guest', 'role': 'user',
                'exp': int(time.time()) + 3600
            }, WEAK_SECRET)
            self.send_html(WELCOME.format(token=guest_token))

        elif path == '/login':
            token = params.get('token', [''])[0]
            if not token:
                self.send_json({'error': 'provide ?token=X'}, 400)
                return
            payload = verify_token(token)
            if payload is None:
                self.send_json({'error': 'invalid token', 'hint': 'try alg:none'}, 401)
                return
            role = payload.get('role', 'user')
            user = payload.get('user', 'unknown')

            if role == 'admin':
                # Admin gets all flags
                self.send_json({
                    'status': 'admin', 'user': user,
                    'flag_1': FLAG_1,
                    'flag_2': FLAG_2,
                    'flag_3': FLAG_3,
                    'payload': payload,
                })
            elif role == 'premium':
                self.send_json({
                    'status': 'premium', 'user': user,
                    'flag_2': FLAG_2,
                    'hint': 'admin gets more... try role:admin',
                })
            else:
                self.send_json({
                    'status': 'user', 'user': user,
                    'message': 'Logged in as regular user',
                    'hint': 'decode your token, modify role, change alg to none',
                })

        elif path == '/crack':
            # Provide a hash of the weak secret for cracking practice
            secret_hash = hashlib.sha256(WEAK_SECRET.encode()).hexdigest()
            self.send_json({
                'challenge': 'Crack this SHA256 hash to find the JWT secret',
                'hash': secret_hash,
                'hint': 'The secret is a common phrase (try rockyou.txt top 1000)',
            })

        elif path == '/strong':
            # Endpoint that uses the STRONG secret (for comparison)
            strong_token = make_hs256_token({
                'user': 'admin', 'role': 'admin', 'exp': int(time.time()) + 3600
            }, STRONG_SECRET)
            # Give them the token but also a hash of the secret to show it's uncrackable
            strong_hash = hashlib.sha256(STRONG_SECRET.encode()).hexdigest()
            self.send_json({
                'token': strong_token,
                'secret_hash': strong_hash,
                'message': 'This token uses a STRONG secret. Try cracking it!',
            })

        else:
            self.send_html(NOT_FOUND, 404)

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
<html><head><title>JWT Attack Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔑 JWT Attack Lab</h1>
<p>Your token: <code style="color:#58a6ff;word-break:break-all">{token}</code></p>
<h3>Attacks to try:</h3>
<ul>
<li><b>alg:none</b>: decode, change alg to "none", role to "admin", remove signature</li>
<li><b>Weak secret</b>: <a href="/crack" style="color:#58a6ff">/crack</a> gives a hash to crack</li>
<li><b>Forged token</b>: once you know the secret, forge any token you want</li>
</ul>
<p><a href="/login?token={token}" style="color:#58a6ff">Test your token</a></p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'JWT attack lab on :8080')
    server.serve_forever()
