"""Web app with hidden directories for content discovery — Python stdlib."""
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

# Hidden paths with different response codes
HIDDEN_PATHS = {
    '/admin': {'code': 200, 'body': f'<h1>Admin Panel</h1><p>Flag: {FLAG_1}</p>'},
    '/backup': {'code': 200, 'body': '<h1>Backup Directory</h1><a href="/backup/db.sql">db.sql</a>'},
    '/backup/db.sql': {'code': 200, 'body': f'CREATE DATABASE prod;\n-- secret: {FLAG_2}'},
    '/config': {'code': 403, 'body': '<h1>403 Forbidden</h1><p>Access denied</p>'},
    '/debug': {'code': 200, 'body': '<h1>Debug Info</h1><p>env=production db=postgres</p>'},
    '/dev': {'code': 301, 'body': '', 'location': '/dev/index.html'},
    '/dev/index.html': {'code': 200, 'body': f'<h1>Dev Environment</h1><p>{FLAG_3}</p>'},
    '/old': {'code': 200, 'body': '<h1>Old Site (v1)</h1><p>Deprecated but still running</p>'},
    '/api': {'code': 200, 'body': '<h1>API v1</h1><p>GET /api/users, GET /api/config</p>'},
    '/api/users': {'code': 200, 'body': '[{"id":1,"name":"admin"},{"id":2,"name":"user"}]'},
    '/uploads': {'code': 200, 'body': '<h1>Uploads</h1><p>No files yet</p>'},
    '/.git': {'code': 403, 'body': '<h1>403</h1>'},
    '/robots.txt': {'code': 200, 'body': 'User-agent: *\nDisallow: /admin\nDisallow: /backup\nDisallow: /dev'},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0]  # strip query params

        if path == '/':
            self.send_html(WELCOME)
        elif path in HIDDEN_PATHS:
            config = HIDDEN_PATHS[path]
            code = config['code']
            if code == 301:
                self.send_response(301)
                self.send_header('Location', config.get('location', '/'))
                self.end_headers()
            else:
                self.send_html(config['body'], code)
        else:
            self.send_html('<h1>404 Not Found</h1>', 404)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>CorpSite</title></head>
<body style="font-family:sans-serif;padding:40px;background:#fff;color:#333">
<h1>🏢 CorpSite</h1>
<p>Welcome to CorpSite - corporate web presence.</p>
<p>Useful links: <a href="/robots.txt">robots.txt</a></p>
</body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'Gobuster target on :8080')
    server.serve_forever()
