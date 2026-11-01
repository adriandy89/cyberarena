"""Hash cracking challenge server — Python stdlib only."""
import os
import hashlib
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')
FLAG_4 = os.environ.get('FLAG_4', 'FLAG{p}')

# Pre-computed hashes (plaintext passwords are common words)
PASSWORDS = {
    1: ('password', 'md5'),
    2: ('letmein', 'sha1'),
    3: ('qwerty', 'sha256'),
    4: ('admin123', 'sha256'),  # This one's hash IS the flag
}

CHALLENGES = {}
for level, (pw, algo) in PASSWORDS.items():
    if algo == 'md5':
        h = hashlib.md5(pw.encode()).hexdigest()
    elif algo == 'sha1':
        h = hashlib.sha1(pw.encode()).hexdigest()
    else:
        h = hashlib.sha256(pw.encode()).hexdigest()
    flag_var = [FLAG_1, FLAG_2, FLAG_3, FLAG_4][level - 1]
    CHALLENGES[level] = {
        'algorithm': algo,
        'hash': h,
        'plaintext': pw,
        'flag': flag_var,
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path.startswith('/challenge/'):
            try:
                level = int(path.split('/')[-1])
                self.handle_challenge(level, params)
            except ValueError:
                self.send_json({'error': 'invalid level'}, 400)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_challenge(self, level, params):
        if level not in CHALLENGES:
            self.send_json({'error': 'level not found', 'levels': list(CHALLENGES.keys())}, 404)
            return

        challenge = CHALLENGES[level]
        answer = params.get('answer', [''])[0]

        if answer == challenge['plaintext']:
            self.send_json({
                'status': 'correct',
                'message': f'Cracked! The password was: {challenge["plaintext"]}',
                'flag': challenge['flag'],
            })
        elif answer:
            self.send_json({
                'status': 'wrong',
                'message': 'Not the right plaintext. Try cracking the hash!',
                'hash': challenge['hash'],
                'algorithm': challenge['algorithm'],
            })
        else:
            # Show the challenge
            self.send_json({
                'level': level,
                'algorithm': challenge['algorithm'],
                'hash': challenge['hash'],
                'hint': 'Use an online hash database (crackstation.net) or john/hashcat with rockyou.txt',
            })

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(str(data).replace("'", '"').encode())

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>Hash Cracking Challenge</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔓 Hash Cracking Challenge</h1>
<p>Four levels of increasing difficulty. Crack the hash, submit the plaintext, get the flag.</p>
<ul>
<li><a href="/challenge/1" style="color:#58a6ff">Level 1: MD5 (easy)</a></li>
<li><a href="/challenge/2" style="color:#58a6ff">Level 2: SHA1</a></li>
<li><a href="/challenge/3" style="color:#58a6ff">Level 3: SHA256</a></li>
<li><a href="/challenge/4" style="color:#58a6ff">Level 4: SHA256 (harder password)</a></li>
</ul>
<p style="color:#8b949e;font-size:12px">Tools: crackstation.net, hashcat, john, or even Python's hashlib</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Hash cracking lab on :8080')
    server.serve_forever()
