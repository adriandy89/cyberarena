"""Vulnerable web app for the sqli-basico lab — Python stdlib only."""
import sqlite3
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{placeholder}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{placeholder}')


def init_db():
    conn = sqlite3.connect(':memory:')
    c = conn.cursor()
    c.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT, secret TEXT)')
    c.execute('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL, description TEXT)')
    # Users (note the secret column — SQLi can dump it)
    c.execute("INSERT INTO users VALUES (1, 'admin', 'admin123', 'admin@shop.local', ?)", (FLAG_1,))
    c.execute("INSERT INTO users VALUES (2, 'ana', 'password1', 'ana@shop.local', 'normal_user')")
    c.execute("INSERT INTO users VALUES (3, 'bob', 'bob2000', 'bob@shop.local', 'normal_user')")
    # Products
    c.execute("INSERT INTO products VALUES (1, 'Laptop Pro', 999.99, 'High-end laptop')")
    c.execute("INSERT INTO products VALUES (2, 'Mouse Gaming', 49.99, 'RGB mouse')")
    c.execute("INSERT INTO products VALUES (3, 'Keyboard Mech', 129.99, ?)", (FLAG_2,))
    c.execute("INSERT INTO products VALUES (4, 'Monitor 4K', 399.99, 'Ultra HD monitor')")
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
        elif path == '/search':
            self.handle_search(params)
        elif path == '/login':
            self.handle_login(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_search(self, params):
        query = params.get('q', [''])[0]
        # VULNERABLE: direct string interpolation into SQL
        sql = f"SELECT id, name, price, description FROM products WHERE name LIKE '%{query}%' OR description LIKE '%{query}%'"
        try:
            cursor = DB.execute(sql)
            rows = cursor.fetchall()
            results = ''.join(
                f'<div class="product"><h3>{r[1]}</h3><p>Price: ${r[2]}</p><p>{r[3]}</p></div>'
                for r in rows
            )
            if not results:
                results = '<p>No products found.</p>'
            self.send_html(SEARCH_PAGE.format(query=query, results=results))
        except Exception as e:
            # Error messages leak SQL structure
            self.send_html(ERROR_PAGE.format(query=query, error=str(e)), 500)

    def handle_login(self, params):
        username = params.get('username', [''])[0]
        password = params.get('password', [''])[0]
        # VULNERABLE: direct interpolation
        sql = f"SELECT id, username, email FROM users WHERE username='{username}' AND password='{password}'"
        try:
            cursor = DB.execute(sql)
            row = cursor.fetchone()
            if row:
                self.send_html(LOGIN_OK.format(user=row[1], email=row[2]))
            else:
                self.send_html(LOGIN_FAIL.format(username=username))
        except Exception as e:
            self.send_html(ERROR_PAGE.format(query=username, error=str(e)), 500)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass  # quiet


WELCOME = """<!DOCTYPE html>
<html><head><title>TechShop</title></head>
<body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#e0e0e0">
<h1>🖥️ TechShop</h1>
<p>Welcome to TechShop! Search for products or login.</p>
<form action="/search" method="GET">
<input type="text" name="q" placeholder="Search products..." size="40" style="background:#16213e;color:#fff;border:1px solid #0f3460;padding:8px">
<button type="submit" style="background:#0f3460;color:#fff;padding:8px 16px;border:none">Search</button>
</form>
<br>
<form action="/login" method="GET">
<input type="text" name="username" placeholder="Username" style="background:#16213e;color:#fff;border:1px solid #0f3460;padding:8px">
<input type="password" name="password" placeholder="Password" style="background:#16213e;color:#fff;border:1px solid #0f3460;padding:8px">
<button type="submit" style="background:#e94560;color:#fff;padding:8px 16px;border:none">Login</button>
</form>
</body></html>"""

SEARCH_PAGE = """<!DOCTYPE html>
<html><head><title>Search: {query}</title></head>
<body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#e0e0e0">
<h1>Search Results for: {query}</h1>
<div style="color:#e94560;font-size:12px">DEBUG: SELECT id, name, price, description FROM products WHERE name LIKE '%{query}%'</div>
<br>
{results}
<br><a href="/" style="color:#0f3460">&larr; Back</a>
</body></html>"""

ERROR_PAGE = """<!DOCTYPE html>
<html><head><title>Error</title></head>
<body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#ff6b6b">
<h1>Database Error</h1>
<p>Query: {query}</p>
<pre style="background:#16213e;padding:20px;border-radius:8px;overflow-x:auto">{error}</pre>
<a href="/" style="color:#0f3460">&larr; Back</a>
</body></html>"""

LOGIN_OK = """<!DOCTYPE html>
<html><head><title>Welcome</title></head>
<body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#00ff88">
<h1>✅ Login Successful!</h1>
<p>Welcome, <b>{user}</b>!</p>
<p>Email: {email}</p>
<a href="/" style="color:#0f3460">&larr; Back</a>
</body></html>"""

LOGIN_FAIL = """<!DOCTYPE html>
<html><head><title>Login Failed</title></head>
<body style="font-family:monospace;padding:40px;background:#1a1a2e;color:#ff6b6b">
<h1>❌ Login Failed</h1>
<p>Invalid credentials for: {username}</p>
<a href="/" style="color:#0f3460">&larr; Back</a>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1><p>Not found</p></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'SQLi lab running on :8080')
    server.serve_forever()
