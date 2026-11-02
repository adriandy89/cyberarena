"""C2 simulation lab: beacons, jitter, DNS exfil, detection."""
import os, json, time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(3)}

beacons = []      # simulated C2 beacon log
dns_queries = []  # each entry: {query, timestamp, exfil_detected}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/beacon':
            self.handle_beacon(params, jitter=False)
        elif path == '/beacon-jitter':
            self.handle_beacon(params, jitter=True)
        elif path == '/dns':
            self.handle_dns(params)
        elif path == '/logs':
            self.handle_logs()
        elif path == '/detect':
            self.handle_detect()
        else:
            self.send_html('<h1>404</h1>', 404)

    def handle_beacon(self, params, jitter=False):
        """Simulates an implant beaconing back to the C2 server."""
        implant = params.get('id', ['unknown'])[0]
        ts = time.time()
        interval = float(params.get('interval', ['5'])[0])
        jitter_pct = float(params.get('jitter', ['0'])[0]) if jitter else 0.0
        # deterministic pseudo-variation so each jittered beacon differs
        variation = ((ts * 1000) % 97) / 97.0  # 0..1
        actual_delay = round(interval * (1 + (variation - 0.5) * 2 * jitter_pct / 100), 2)

        beacons.append({
            'implant': implant,
            'timestamp': ts,
            'interval': interval,
            'actual_delay': actual_delay,
            'jitter': jitter_pct,
            'url': '/gate.php',
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
        })
        self.send_json({'status': 'ok', 'command': 'sleep', 'sleep_seconds': actual_delay})

    def handle_dns(self, params):
        """Simulates DNS resolution used as an exfiltration channel."""
        query = params.get('q', [''])[0]
        exfil = len(query) > 30
        entry = {'query': query, 'timestamp': time.time(), 'exfil_detected': exfil}
        dns_queries.append(entry)
        answer = {'status': 'resolved', 'query': query, 'exfil_detected': exfil}
        if exfil:
            answer['tunneled_bytes'] = len(query)
            answer['flag'] = F[2]
        self.send_json(answer)

    def handle_logs(self):
        self.send_json({
            'beacons': beacons[-20:],
            'dns_queries': dns_queries[-20:],
        })

    def handle_detect(self):
        """Defender's correlation engine: analyze collected traffic."""
        alerts = []

        no_jitter = [b for b in beacons if not b['jitter']]
        with_jitter = [b for b in beacons if b['jitter']]

        # Rule 1: fixed-interval beaconing = C2 signature
        if len(no_jitter) >= 3:
            delays = [b['actual_delay'] for b in no_jitter]
            if len(set(delays)) == 1:
                alerts.append({
                    'type': 'FIXED_INTERVAL_BEACON',
                    'severity': 'HIGH',
                    'detail': f'{len(no_jitter)} beacons from implant '
                              f'{no_jitter[0]["implant"]} at exactly {delays[0]}s apart',
                    'flag': F[1],
                })

        # Rule 2: jittered beaconing blends in (report for the learner)
        if len(with_jitter) >= 3:
            delays = [b['actual_delay'] for b in with_jitter]
            alerts.append({
                'type': 'INFO',
                'severity': 'LOW',
                'detail': f'{len(with_jitter)} jittered beacons with varying delays {delays} '
                          f'— blended with normal traffic, no fixed signature',
            })

        # Rule 3: DNS tunneling
        exfils = [q for q in dns_queries if q['exfil_detected']]
        if exfils:
            alerts.append({
                'type': 'DNS_EXFIL',
                'severity': 'CRITICAL',
                'detail': f'{len(exfils)} oversized DNS queries '
                          f'(longest {max(len(q["query"]) for q in exfils)} chars)',
            })

        correlated = len(alerts) >= 2 or any(a['severity'] == 'CRITICAL' for a in alerts)
        self.send_json({
            'alerts': alerts,
            'summary': f'{len(beacons)} beacons and {len(dns_queries)} DNS queries analyzed',
            'correlated_attack': correlated,
            'flag_if_detected': F[3] if correlated else None,
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

    def log_message(self, *a):
        pass


WELCOME = """<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>C2 Simulation Lab</h1>
<p>Play both attacker and blue-teamer against the same traffic.</p>
<h3>As attacker (implant side)</h3>
<ul>
<li><a href="/beacon?id=implant1&amp;interval=5" style="color:#58a6ff">/beacon?id=implant1&amp;interval=5</a> &mdash; beacon with a fixed 5s interval (noisy)</li>
<li><a href="/beacon-jitter?id=implant2&amp;interval=5&amp;jitter=40" style="color:#58a6ff">/beacon-jitter?id=implant2&amp;interval=5&amp;jitter=40</a> &mdash; beacon with 40% jitter (stealthy)</li>
<li><a href="/dns?q=dGVzdGRhdGFleGZpbHRyYXRpb24.example.com" style="color:#58a6ff">/dns?q=&lt;long-subdomain&gt;.example.com</a> &mdash; DNS exfiltration channel</li>
</ul>
<h3>As defender (SOC side)</h3>
<ul>
<li><a href="/logs" style="color:#58a6ff">/logs</a> &mdash; raw collected traffic</li>
<li><a href="/detect" style="color:#58a6ff">/detect</a> &mdash; correlation engine (pattern analysis)</li>
</ul>
<p style="color:#d29922;font-size:12px">Send at least 3 no-jitter beacons, then run /detect. Compare with jittered beacons.</p>
</body></html>"""

if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
