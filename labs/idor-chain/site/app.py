"""IDOR chain lab: user enumeration → data access → role escalation."""
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

# Simulated user database
USERS = {
    1: {'id': 1, 'name': 'admin', 'email': 'admin@corp.com', 'role': 'admin',
        'api_key': 'sk-admin-xyz', 'secret': FLAG_1},
    2: {'id': 2, 'name': 'alice', 'email': 'alice@corp.com', 'role': 'user',
        'api_key': None, 'secret': 'regular_user'},
    3: {'id': 3, 'name': 'bob', 'email': 'bob@corp.com', 'role': 'user',
        'api_key': None, 'secret': 'regular_user'},
    4: {'id': 4, 'name': 'svc_backup', 'email': 'svc@corp.com', 'role': 'service',
        'api_key': 'sk-svc-backup', 'secret': FLAG_2},
}

# Simulated orders
ORDERS = {
    1001: {'id': 1001, 'user_id': 2, 'amount': 49.99, 'item': 'Laptop'},
    1002: {'id': 1002, 'user_id': 1, 'amount': 999.99, 'item': 'Server', 'internal_note': FLAG_3},
    1003: {'id': 1003, 'user_id': 3, 'amount': 19.99, 'item': 'Mouse'},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/api/users':
            self.send_json({'users': [{'id': u['id'], 'name': u['name']} for u in USERS.values()]})
        elif path.startswith('/api/user/'):
            try:
                uid = int(path.split('/')[-1])
                self.get_user(uid)
            except ValueError:
                self.send_json({'error': 'invalid id'}, 400)
        elif path.startswith('/api/order/'):
            try:
                oid = int(path.split('/')[-1])
                self.get_order(oid)
            except ValueError:
                self.send_json({'error': 'invalid id'}, 400)
        elif path == '/api/me':
            self.get_me(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def get_user(self, uid):
        user = USERS.get(uid)
        if not user:
            self.send_json({'error': 'not found'}, 404)
            return

        # VULNERABLE: no ownership check
        # A normal user (id=2) can view admin (id=1) and service accounts
        safe_data = {k: v for k, v in user.items() if k != 'secret'}
        # But if you know the "expand" parameter, you get everything
        if 'expand' in self.path:
            safe_data['secret'] = user['secret']
        self.send_json(safe_data)

    def get_order(self, oid):
        order = ORDERS.get(oid)
        if not order:
            self.send_json({'error': 'not found'}, 404)
            return
        # VULNERABLE: no ownership check
        self.send_json(order)

    def get_me(self, params):
        # Simulated "current user" endpoint — user id=2 (alice)
        # VULNERABLE: accepts arbitrary user_id parameter (mass assignment)
        requested_id = params.get('user_id', ['2'])[0]
        try:
            uid = int(requested_id)
        except ValueError:
            uid = 2

        user = USERS.get(uid, USERS[2])
        # VULNERABLE: "role" parameter can be injected
        role = params.get('role', [user['role']])[0]
        user_data = dict(user)
        user_data['role'] = role  # Mass assignment: role is user-controlled!

        self.send_json(user_data)

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
<html><head><title>CorpAPI</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🏢 CorpAPI v1</h1>
<p>You are user <b>alice</b> (id=2). Explore the API:</p>
<ul>
<li><a href="/api/users" style="color:#58a6ff">GET /api/users</a> — list all users</li>
<li><a href="/api/user/2" style="color:#58a6ff">GET /api/user/2</a> — your profile</li>
<li><a href="/api/user/1" style="color:#58a6ff">GET /api/user/1</a> — admin profile (IDOR!)</li>
<li><a href="/api/order/1002" style="color:#58a6ff">GET /api/order/1002</a> — admin's order</li>
<li><a href="/api/me" style="color:#58a6ff">GET /api/me</a> — current user info</li>
<li><a href="/api/me?user_id=1&role=admin" style="color:#58a6ff">GET /api/me?user_id=1&role=admin</a> — mass assignment!</li>
</ul>
<p style="color:#d29922;font-size:12px">Hints: try ?expand on user endpoints; try changing user_id and role in /api/me</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'IDOR chain lab on :8080')
    server.serve_forever()
