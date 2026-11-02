"""GraphQL security lab: introspection, IDOR and injection (stdlib mini-parser).

The query language is a faithful subset of GraphQL: fields with arguments,
nested selection sets and __schema introspection — enough for real
graphql-style attacks against a deliberately broken resolver.
"""
import json
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(3)}

CURRENT_USER = {'id': 2, 'name': 'alice', 'role': 'user'}

USERS = {
    1: {'id': 1, 'name': 'admin', 'email': 'admin@corp.internal', 'role': 'admin', 'note': F[1]},
    2: {'id': 2, 'name': 'alice', 'email': 'alice@corp.com', 'role': 'user'},
    3: {'id': 3, 'name': 'bob', 'email': 'bob@corp.com', 'role': 'user'},
}

DOCUMENTS = [
    {'title': 'Q4 Roadmap', 'owner': 'admin', 'class': 'public'},
    {'title': 'Payroll Adjustments', 'owner': 'hr', 'class': 'internal'},
    {'title': F'Incident Postmortem (contains {F[2]})', 'owner': 'security', 'class': 'restricted'},
]

# Hidden type only introspection reveals
SCHEMA_TYPES = [
    {'name': 'Query', 'fields': ['user(id: Int!): User', 'users: [User]', 'search(q: String!): [Document]', 'systemInfo: String']},
    {'name': 'User', 'fields': ['id: Int!', 'name: String!', 'email: String!', 'role: String!', 'note: String']},
    {'name': 'Document', 'fields': ['title: String!', 'owner: String!', 'class: String!']},
    {'name': 'SecretFlag', 'fields': ['value: String!'], 'hidden': True,
     'hint': 'query { secretFlag { value } } — resolvers exist for every type'},
]


def parse_fields(body: str):
    """Extract requested top-level fields with their argument blocks."""
    fields = {}
    for match in re.finditer(r'(\w+)\s*(?:\(([^)]*)\))?\s*\{', body):
        name, args_raw = match.group(1), match.group(2) or ''
        inner_start = match.end()
        depth, i = 1, inner_start
        while i < len(body) and depth:
            if body[i] == '{':
                depth += 1
            elif body[i] == '}':
                depth -= 1
            i += 1
        fields[name] = {'args': parse_args(args_raw), 'sub': body[inner_start:i - 1]}
    return fields


def parse_args(raw: str):
    args = {}
    for match in re.finditer(r'(\w+)\s*:\s*("?)([^",)]+)\2', raw):
        args[match.group(1)] = match.group(3).strip()
    return args


def resolve(body: str):
    fields = parse_fields(body)
    data = {}
    errors = []
    for name, spec in fields.items():
        if name == '__schema':
            data['__schema'] = {'types': SCHEMA_TYPES}
        elif name == 'secretFlag':
            # resolver bound to the hidden type — introspection was the map
            data['secretFlag'] = {'value': F[3] if 'value' in spec['sub'] else '<field: value>'}
        elif name == 'user':
            uid = int(spec['args'].get('id', '0') or 0)
            user = USERS.get(uid)
            if user:
                data['user'] = {k: v for k, v in user.items() if k in spec['sub'] or k in ('id', 'name')}
            else:
                errors.append(f'user {uid} not found')
        elif name == 'users':
            data['users'] = [{'id': u['id'], 'name': u['name']} for u in USERS.values()]
        elif name == 'search':
            q = spec['args'].get('q', '')
            # VULNERABLE: the filter is string-interpolated (simulated SQL injection)
            if q.strip() in ("' OR '1'='1", "' OR 1=1--", "x' OR '1'='1") or re.search(r"'\s*or\s*'?1'?='?1", q, re.I):
                data['search'] = DOCUMENTS  # filter collapsed -> everything
            else:
                data['search'] = [d for d in DOCUMENTS if q.lower() in d['title'].lower()]
        elif name == 'systemInfo':
            data['systemInfo'] = 'corp-api 1.4.2 (graphql)'
        else:
            errors.append(f'cannot query field "{name}"')
    return {'data': data, **({'errors': errors} if errors else {})}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_html(WELCOME)
        else:
            self.send_html('<h1>404 — POST your queries to /graphql</h1>', 404)

    def do_POST(self):
        if not self.path.startswith('/graphql'):
            self.send_json({'error': 'not found'}, 404)
            return
        length = int(self.headers.get('Content-Length', 0))
        try:
            payload = json.loads(self.rfile.read(length) or b'{}')
            query = payload.get('query', '')
        except json.JSONDecodeError:
            self.send_json({'error': 'invalid JSON'}, 400)
            return
        if not query.strip():
            self.send_json({'error': 'missing "query"'}, 400)
            return
        self.send_json(resolve(query))

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

    def log_message(self, *a):
        pass


WELCOME = """<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>GraphCorp API</h1>
<p>Single endpoint: <code>POST /graphql</code>. You are alice (id=2, role=user).</p>
<pre>curl -s http://127.0.0.1:18109/graphql \\
  -H 'Content-Type: application/json' \\
  -d '{"query": "{ users { id name } }"}'</pre>
<p style="color:#d29922;font-size:12px">Introspection is ON. Where there is a schema, there is a way.</p>
</body></html>"""

if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
