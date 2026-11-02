"""Log injection lab: CRLF, XSS via logs, log poisoning."""
import os, json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i+1: os.environ.get(f'FLAG_{i+1}', 'FLAG{p}') for i in range(3)}

logs = []

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/': self.send_html(WELCOME)
        elif path == '/feedback': self.handle_feedback(params)
        elif path == '/logs': self.handle_logs()
        else: self.send_html('<h1>404</h1>', 404)

    def handle_feedback(self, params):
        msg = params.get('msg', [''])[0]
        if not msg:
            self.send_html(FORM)
            return

        # VULNERABLE: writes raw user input to logs without sanitization
        log_line = f'[INFO] User alice said: {msg}'
        logs.append(log_line)

        # Detect achievements
        achievements = []
        if '\r\n' in msg or '%0d%0a' in msg:
            achievements.append('CRLF_INJECTION')
            # If they injected a fake "success" line
            if 'success' in msg.lower() or 'admin' in msg.lower():
                achievements.append('LOG_FORGED')
                logs.append(f'[INFO] FLAG achieved: {F[1]}')

        if '<script' in msg.lower() or '<img' in msg.lower() or '<svg' in msg.lower():
            achievements.append('XSS_IN_LOG')
            logs.append(f'[XSS] FLAG: {F[2]}')

        if '../' in msg or '/etc/' in msg:
            achievements.append('LOG_POISONING')
            logs.append(f'[POISON] FLAG: {F[3]}')

        result = {'status': 'feedback submitted', 'achievements': achievements}
        if 'LOG_FORGED' in achievements: result['flag_1'] = F[1]
        if 'XSS_IN_LOG' in achievements: result['flag_2'] = F[2]
        if 'LOG_POISONING' in achievements: result['flag_3'] = F[3]

        self.send_json(result)

    def handle_logs(self):
        # Simulates an admin viewing logs in a browser (vulnerable to XSS from injected logs)
        html = '<html><body style="background:#111;color:#0f0;font-family:monospace;padding:20px"><h1>📊 Admin Log Viewer</h1><pre>'
        for line in logs:
            html += line + '\n'  # VULNERABLE: renders raw HTML from logs
        html += '</pre></body></html>'
        self.send_html(html)

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
<h1>📝 Log Injection Lab</h1>
<ul><li><a href="/feedback" style="color:#58a6ff">/feedback</a> — Submit feedback (gets logged)</li>
<li><a href="/logs" style="color:#58a6ff">/logs</a> — Admin log viewer (renders raw HTML!)</li></ul>
<p style="color:#d29922;font-size:12px">Hints: CRLF = %0d%0a, XSS = &lt;script&gt;alert(1)&lt;/script&gt;, path traversal = ../../etc/passwd</p>
</body></html>"""

FORM = """<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>Feedback</h1><form action="/feedback" method="GET">
<input name="msg" size="50" placeholder="Your message (gets logged)" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Submit</button></form></body></html>"""
if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
