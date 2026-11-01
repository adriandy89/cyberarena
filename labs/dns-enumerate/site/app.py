"""DNS enumeration lab: zone transfer simulation + subdomain discovery."""
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')

# Simulated DNS zone
ZONE = {
    'victima.com': {'type': 'SOA', 'ns': 'ns1.victima.com'},
    'ns1.victima.com': {'type': 'A', 'ip': '10.10.10.1'},
    'ns2.victima.com': {'type': 'A', 'ip': '10.10.10.2'},
    'www.victima.com': {'type': 'A', 'ip': '10.10.10.10'},
    'mail.victima.com': {'type': 'A', 'ip': '10.10.10.20'},
    'vpn.victima.com': {'type': 'A', 'ip': '10.10.10.30', 'note': 'internal VPN'},
    'dev.victima.com': {'type': 'A', 'ip': '10.10.10.40', 'note': 'dev environment'},
    'staging.victima.com': {'type': 'A', 'ip': '10.10.10.41', 'note': FLAG_1},
    'jenkins.victima.com': {'type': 'A', 'ip': '10.10.10.50', 'note': 'CI/CD server'},
    'internal.victima.com': {'type': 'A', 'ip': '10.10.10.100', 'note': FLAG_2},
    '_ldap._tcp.victima.com': {'type': 'SRV', 'target': 'dc01.victima.com', 'port': 389},
    'dc01.victima.com': {'type': 'A', 'ip': '10.10.10.200', 'note': 'Domain Controller'},
}

# Hidden subdomain (only discovered via zone transfer)
HIDDEN = {
    'secret-admin.victima.com': {'type': 'A', 'ip': '10.10.10.66', 'note': 'hidden admin panel'},
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/dig':
            self.handle_dig(params)
        elif path == '/axfr':
            self.handle_axfr(params)
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_dig(self, params):
        """Simulates dig/query for a specific hostname."""
        name = params.get('name', [''])[0].lower().strip()
        if not name:
            self.send_json({'error': 'provide ?name=hostname'})
            return

        # Check public zone
        if name in ZONE:
            self.send_json({'query': name, **ZONE[name], 'status': 'NOERROR'})
        elif name in HIDDEN:
            self.send_json({'query': name, **HIDDEN[name], 'status': 'NOERROR'})
        else:
            self.send_json({'query': name, 'status': 'NXDOMAIN'})

    def handle_axfr(self, params):
        """Simulates zone transfer (AXFR) — returns ALL records including hidden."""
        server = params.get('server', [''])[0].lower().strip()
        if server not in ('ns1.victima.com', 'ns2.victima.com'):
            self.send_json({'error': 'transfer refused', 'hint': 'try server=ns1.victima.com'})
            return

        # VULNERABLE: zone transfer is allowed for any requester
        all_records = {**ZONE, **HIDDEN}
        result = {name: record for name, record in sorted(all_records.items())}
        self.send_json({
            'status': 'XFER_SIZE_RESPONSE',
            'total_records': len(result),
            'records': result,
            'hint': f'Zone transfer successful! {len(HIDDEN)} hidden records found.',
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
<html><head><title>DNS Enumeration Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🌐 DNS Enumeration Lab</h1>
<p>Simulated DNS for victima.com. Try:</p>
<ul>
<li><a href="/dig?name=www.victima.com" style="color:#58a6ff">/dig?name=www.victima.com</a> — Query a record</li>
<li><a href="/dig?name=dev.victima.com" style="color:#58a6ff">/dig?name=dev.victima.com</a> — Dev subdomain</li>
<li><a href="/axfr?server=ns1.victima.com" style="color:#58a6ff">/axfr?server=ns1.victima.com</a> — Zone transfer!</li>
</ul>
<p style="color:#d29922;font-size:12px">The zone transfer (AXFR) dumps ALL records, including hidden ones. This is a classic misconfig.</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'DNS enumeration lab on :8080')
    server.serve_forever()
