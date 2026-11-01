"""Fake company website for OSINT practice — Python stdlib only."""
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')
FLAG_4 = os.environ.get('FLAG_4', 'FLAG{p}')

PAGES = {
    '/': ('text/html', f"""<!DOCTYPE html>
<html><head>
<title>TechCorp Solutions</title>
<!-- DEV NOTE: staging server at staging.techcorp.local (do not share externally) -->
<!-- TODO: remove admin panel link before production deploy -->
<meta name="author" content="jperez@techcorp.local">
<meta name="generator" content="WordPress 6.4">
</head>
<body style="font-family:sans-serif;padding:40px;background:#f5f5f5;color:#333">
<h1>🏢 TechCorp Solutions</h1>
<p>Leading provider of innovative technology solutions since 2015.</p>
<ul>
<li><a href="/about">About Us</a></li>
<li><a href="/contact">Contact</a></li>
</ul>
<!-- Internal: admin at /admin/panel (remove before launch) -->
</body></html>"""),

    '/robots.txt': ('text/plain', f"""User-agent: *
Disallow: /admin
Disallow: /staging
Disallow: /.env
Disallow: /old-site
# FLAG: {FLAG_1}
"""),

    '/about': ('text/html', f"""<!DOCTYPE html>
<html><head><title>About TechCorp</title></head>
<body style="font-family:sans-serif;padding:40px">
<h1>About Us</h1>
<p>Our team:</p>
<ul>
<li>CEO: John Perez (jperez@techcorp.local)</li>
<li>CTO: Maria Garcia (mgarcia@techcorp.local)</li>
<li>DevOps: David Kim (dkim@techcorp.local) <!-- contractor: dkim@external-agency.com -->
</ul>
<!-- Developer note: {FLAG_2} -->
</body></html>"""),

    '/contact': ('text/html', """<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px">
<h1>Contact</h1>
<p>Email: info@techcorp.local</p>
<p>Phone: +1-555-0100</p>
</body></html>"""),

    '/.env': ('text/plain', f"""APP_NAME=TechCorp
APP_ENV=production
DB_HOST=internal-db.techcorp.local
DB_PASSWORD=SuperSecret123!
API_KEY=sk-{''.join(['a']*40)}
DEBUG=false
# Admin password hint: {FLAG_3}
"""),

    '/admin/panel': ('text/html', f"""<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px;background:#1a1a2e;color:#e2e8f0">
<h1>🔐 Admin Panel (DEVELOPMENT)</h1>
<p>If you can see this, you found the hidden admin from source comments!</p>
<p>Flag: <b>{FLAG_4}</b></p>
</body></html>"""),

    '/staging': ('text/html', """<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:40px">
<h1>Staging Environment</h1>
<p>This is the staging server. Features may be incomplete.</p>
</body></html>"""),

    '/old-site': ('text/html', """<!DOCTYPE html>
<html><body style="font-family:serif;padding:40px;background:#ffffcc">
<h1>TechCorp (OLD SITE v1)</h1>
<p>Original website from 2015. Still running for legacy support.</p>
</body></html>"""),
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/') or '/'

        if path in PAGES:
            content_type, body = PAGES[path]
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            self.wfile.write(body.encode())
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b'<h1>404 Not Found</h1>')

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'OSINT target on :8080')
    server.serve_forever()
