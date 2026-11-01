"""Advanced XSS lab: DOM-based, filter bypass, CSP."""
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

# Simulated filter: removes <script> tags
def filter_xss(input_text):
    """Removes <script> tags but is bypassable."""
    import re
    filtered = re.sub(r'<script[^>]*>.*?</script>', '', input_text, flags=re.IGNORECASE | re.DOTALL)
    filtered = re.sub(r'<script[^>]*>', '', filtered, flags=re.IGNORECASE)
    filtered = filtered.replace('</script>', '')
    return filtered


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/dom':
            # DOM-based XSS: JavaScript writes user input to innerHTML
            self.send_html(DOM_PAGE.format(flag=FLAG_1))
        elif path == '/filtered':
            # Filter bypass: filter removes <script> but not other vectors
            user_input = params.get('input', [''])[0]
            filtered = filter_xss(user_input)
            self.send_html(FILTERED_PAGE.format(
                original=user_input.replace('<', '&lt;').replace('>', '&gt;'),
                filtered=filtered,
                flag=FLAG_2))
        elif path == '/csp':
            # Weak CSP: allows inline scripts from same origin
            self.send_html(CSP_PAGE.format(flag=FLAG_3), extra_headers=[
                ('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'")
            ])
        else:
            self.send_html(NOT_FOUND, 404)

    def send_html(self, html, code=200, extra_headers=None):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        if extra_headers:
            for name, value in extra_headers:
                self.send_header(name, value)
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>XSS Advanced Lab</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🎯 XSS Advanced Lab</h1>
<ul>
<li><a href="/dom" style="color:#58a6ff">/dom</a> — DOM-based XSS (inner	location.hash)</li>
<li><a href="/filtered?input=test" style="color:#58a6ff">/filtered?input=X</a> — Filter bypass</li>
<li><a href="/csp" style="color:#58a6ff">/csp</a> — Weak CSP</li>
</ul>
</body></html>"""

DOM_PAGE = """<!DOCTYPE html>
<html><head><title>DOM XSS</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔗 Profile Viewer</h1>
<div id="output"></div>
<!-- Hidden flag in JavaScript variable -->
<script>
var secretFlag = "{flag}";
</script>
<script>
// VULNERABLE: uses location.hash directly in innerHTML (DOM-based XSS)
// Try: #<img src=x onerror=alert(document.body.innerHTML)>
var userInput = decodeURIComponent(location.hash.substring(1));
document.getElementById('output').innerHTML = '<h2>Welcome, ' + userInput + '!</h2>';
</script>
<p>Try appending #your_name to the URL...</p>
</body></html>"""

FILTERED_PAGE = """<!DOCTYPE html>
<html><head><title>Filtered</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🛡️ Filtered Input</h1>
<p>Original: <code>{original}</code></p>
<p>Filtered: <code>{filtered}</code></p>
<p>Output: {filtered}</p>
<!-- Hidden flag for those who bypass the filter -->
<div style="display:none" data-flag="{flag}"></div>
<p style="color:#8b949e;font-size:12px">Filter removes &lt;script&gt; tags. But what about &lt;img&gt;, &lt;svg&gt;, &lt;body&gt;, &lt;iframe&gt;?</p>
</body></html>"""

CSP_PAGE = """<!DOCTYPE html>
<html><head><title>CSP Test</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>🔒 CSP Page</h1>
<p>This page has CSP: script-src 'self' 'unsafe-inline'</p>
<div id="output">No input yet. Try ?input=X</div>
<!-- 'unsafe-inline' means inline scripts ARE allowed -->
<script>
var params = new URLSearchParams(location.search);
var input = params.get('input') || '';
document.getElementById('output').innerHTML = input;
</script>
<!-- Hidden flag -->
<div style="display:none" id="csp-flag">{flag}</div>
<p>Hint: 'unsafe-inline' defeats most CSP protections for inline scripts...</p>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'XSS advanced lab on :8080')
    server.serve_forever()
