"""API security lab: BOLA, BFLA, mass assignment, resource consumption."""
import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

F = {i+1: os.environ.get(f'FLAG_{i+1}', 'FLAG{p}') for i in range(4)}

# Current user is alice (id=2)
CURRENT_USER = {'id': 2, 'name': 'alice', 'role': 'user'}

users = {
    1: {'id':1,'name':'admin','role':'admin','email':'admin@corp.com','flag':F[3]},
    2: {'id':2,'name':'alice','role':'user','email':'alice@corp.com'},
    3: {'id':3,'name':'bob','role':'user','email':'bob@corp.com'},
}
orders = {
    1001: {'id':1001,'user_id':2,'amount':49.99,'item':'Laptop'},
    1002: {'id':1002,'user_id':1,'amount':999.99,'item':'Server','flag':F[1]},
    1003: {'id':1003,'user_id':3,'amount':19.99,'item':'Mouse'},
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.handle_req('GET')
    def do_DELETE(self):
        self.handle_req('DELETE')
    def do_POST(self):
        self.handle_req('POST')

    def handle_req(self, method):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == '/': self.send_html(WELCOME)
        elif path == '/api/me': self.send_json(CURRENT_USER)
        elif path == '/api/users': self.send_json({'users': [{'id':u['id'],'name':u['name']} for u in users.values()]})
        elif path == '/api/orders/create': self.handle_create()
        elif path == '/api/export': self.handle_export()
        elif path.startswith('/api/users/'):
            uid = int(path.split('/')[-1])
            self.handle_user(method, uid)
        elif path.startswith('/api/orders/'):
            oid = int(path.split('/')[-1])
            self.handle_order(method, oid)
        else: self.send_html('<h1>404</h1>', 404)

    def handle_user(self, method, uid):
        if method == 'DELETE':
            # BFLA: only admin should delete, but ANY user can
            user = users.get(uid)
            if user:
                del users[uid]
                self.send_json({'status': 'deleted', 'user': user['name'], 'flag': F[2], 'note': 'BFLA: you should not be able to do this!'})
            else:
                self.send_json({'error': 'not found'}, 404)
        else:
            user = users.get(uid)
            if user:
                self.send_json(user)
            else:
                self.send_json({'error': 'not found'}, 404)

    def handle_order(self, method, oid):
        order = orders.get(oid)
        if not order: self.send_json({'error': 'not found'}, 404); return
        # BOLA: no ownership check
        self.send_json({**order, 'note': 'BOLA: this order belongs to user ' + str(order['user_id']) + ' but you are user 2'})

    def handle_create(self):
        # Mass assignment: accepts arbitrary fields
        # Read body
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length) or b'{}')
        new_user = {'id': len(users)+1, 'name': body.get('name', 'new'), 'role': body.get('role', 'user'), 'email': body.get('email', '')}
        users[new_user['id']] = new_user
        if new_user['role'] == 'admin':
            self.send_json({'status': 'created', 'user': new_user, 'flag': F[3], 'note': 'MASS ASSIGNMENT: you set role=admin!'})
        else:
            self.send_json({'status': 'created', 'user': new_user})

    def handle_export(self):
        # Unrestricted resource consumption: no rate limit, dumps everything
        self.send_json({'flag': F[4], 'all_users': {str(k): v for k, v in users.items()}, 'all_orders': {str(k): v for k, v in orders.items()}})

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
<h1>🔌 CorpAPI (Vulnerable)</h1><p>You are <b>alice</b> (user id=2, role=user)</p><ul>
<li><a href="/api/me" style="color:#58a6ff">GET /api/me</a></li>
<li><a href="/api/orders/1002" style="color:#58a6ff">GET /api/orders/1002</a> (BOLA: admin's order)</li>
<li><a href="/api/users" style="color:#58a6ff">GET /api/users</a> (list all)</li>
<li><a href="/api/export" style="color:#58a6ff">GET /api/export</a> (dump everything)</li></ul>
<p style="color:#d29922">Try: DELETE /api/users/3 and POST /api/orders/create with {"role":"admin"}</p>
</body></html>"""
if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
