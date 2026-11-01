"""Multi-layer crypto puzzle: decode chains to find flags."""
import os
import json
import base64
import hashlib
import codecs
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')


def rot13(text):
    return codecs.encode(text, 'rot_13')


def xor_decode(text, key):
    return ''.join(chr(ord(c) ^ ord(key[i % len(key)])) for i, c in enumerate(text))


# Challenge 1: base64 of the flag
CH1_ENCODED = base64.b64encode(FLAG_1.encode()).decode()

# Challenge 2: base64(ROT13(flag))
CH2_ENCODED = base64.b64encode(rot13(FLAG_2).encode()).decode()

# Challenge 3: XOR with key, then base64
CH3_XOR = xor_decode(FLAG_3, 'ctf')
CH3_ENCODED = base64.b64encode(CH3_XOR.encode()).decode()

CHALLENGES = {
    1: {
        'title': 'Single Layer',
        'description': 'This string is base64 encoded. Decode it.',
        'encoded': CH1_ENCODED,
        'hint': 'echo STRING | base64 -d',
        'answer': FLAG_1,
    },
    2: {
        'title': 'Double Layer',
        'description': 'This string is base64(ROT13(flag)). Peel both layers.',
        'encoded': CH2_ENCODED,
        'hint': 'echo STRING | base64 -d | tr "A-Za-z" "N-ZA-Mn-za-m"',
        'answer': FLAG_2,
    },
    3: {
        'title': 'Triple Layer',
        'description': 'This string is base64(XOR(flag, key)). The key is "ctf".',
        'encoded': CH3_ENCODED,
        'hint': 'echo STRING | base64 -d, then XOR with key "ctf" (use CyberChef)',
        'answer': FLAG_3,
    },
}


class Handler(BaseHTTPRequestHandler):
    do_get_paths = {'/', '/challenge'}

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
            self.send_json({'error': 'not found', 'levels': list(CHALLENGES.keys())}, 404)
            return

        ch = CHALLENGES[level]
        answer = params.get('answer', [''])[0]

        if answer == ch['answer']:
            self.send_json({'status': 'correct', 'message': 'Solved!', 'flag': ch['answer']})
        elif answer:
            self.send_json({'status': 'wrong', 'encoded': ch['encoded']})
        else:
            self.send_json({
                'level': level,
                'title': ch['title'],
                'description': ch['description'],
                'encoded': ch['encoded'],
                'hint': ch['hint'],
            })

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
<html><head><title>Crypto Puzzle</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🧩 Crypto Puzzle Challenge</h1>
<p>Three levels of increasing complexity. Each flag is encoded in multiple layers.</p>
<ul>
<li><a href="/challenge/1" style="color:#58a6ff">Level 1: Base64 (warmup)</a></li>
<li><a href="/challenge/2" style="color:#58a6ff">Level 2: Base64 + ROT13</a></li>
<li><a href="/challenge/3" style="color:#58a6ff">Level 3: Base64 + XOR</a></li>
</ul>
<p style="color:#8b949e;font-size:12px">Tools: terminal (base64, tr), CyberChef, Python</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Crypto puzzle lab on :8080')
    server.serve_forever()
