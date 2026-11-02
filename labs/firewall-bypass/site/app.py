"""Firewall bypass lab: three services behind simulated fw rules.

Rules the "firewall" enforces per service:
  :80   intranet   — blocked for external IPs (returns a block page unless
                     the request arrives tunneled through :443)
  :443  proxy      — open to everyone; serves its own page AND a /fetch
                     tunnel (the "allowed port" that smuggles to :80)
  :8443 admin      — only connections whose SOURCE port is 53 (DNS),
                     the classic allow-list mistake
"""
import json
import os
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(2)}

INTRANET_FLAG = F[1]


class IntranetHandler(BaseHTTPRequestHandler):
    """Port 80: 'blocked' — direct hits get the block page."""

    def do_GET(self):
        client_port = self.client_address[1]
        if client_port == 53 or self.headers.get('X-Tunnel') == 'proxy-443':
            body = (f'<html><body>Intranet (tunneled access granted)<br>'
                    f'Secret: {INTRANET_FLAG}</body></html>').encode()
        else:
            body = '<html><body>403 - blocked by firewall policy (external direct access denied)</body></html>'.encode()
            self.send_html(body, 403)
            return
        self.send_html(body)

    def send_html(self, body, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class ProxyHandler(BaseHTTPRequestHandler):
    """Port 443: open. /fetch?tunnel= gives access to the blocked intranet."""

    def do_GET(self):
        if self.path == '/':
            self.send_html(('<html><body style="font-family:monospace;background:#0d1117;color:#c9d1d9">'
                            '<h1>Secure Gateway</h1><p>Port 443 is open to everyone.</p>'
                            '<p>Endpoints: <code>/fetch?url=http://intranet.local/</code> (internal relay)</p>'
                            '<p style="color:#d29922;font-size:12px">The firewall trusts port 443. '
                            'What ELSE can you reach through it?</p></body></html>').encode())
        elif self.path.startswith('/fetch?'):
            from urllib.parse import urlparse, parse_qs
            qs = parse_qs(urlparse(self.path).query)
            target = qs.get('url', [''])[0]
            if 'intranet' in target:
                # relay carries the X-Tunnel header the intranet trusts
                body = (f'=== relay to {target} ===\n'
                        f'Secret: {INTRANET_FLAG}\n'
                        f'(fw rule: :80 only accepts tunneled traffic from the gateway)').encode()
                self.send_text(body)
            else:
                self.send_text(f'=== relay to {target} ===\n(external, nothing interesting)', 200)
        else:
            self.send_html(b'<h1>404</h1>', 404)

    def send_html(self, body, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, body, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


class AdminHandler(BaseHTTPRequestHandler):
    """Port 8443: firewall allows only source port 53 (the DNS allow-list)."""

    def do_GET(self):
        client_port = self.client_address[1]
        if client_port == 53:
            self.send_json({'admin': True, 'note': 'fw rule matched: source port 53',
                            'flag': F[2]})
        else:
            self.send_json({'error': 'connection dropped by firewall policy',
                            'hint': 'the rule allowlists a well-known SOURCE port'}, 403)

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def log_message(self, *a):
        pass


def serve(port, handler):
    HTTPServer(('0.0.0.0', port), handler).serve_forever()


if __name__ == '__main__':
    for port, handler in ((80, IntranetHandler), (443, ProxyHandler), (8443, AdminHandler)):
        threading.Thread(target=serve, args=(port, handler), daemon=True).start()
    print('[fw-lab] :80 intranet(blocked) :443 gateway(open) :8443 admin(src-port 53)', flush=True)
    threading.Event().wait()
