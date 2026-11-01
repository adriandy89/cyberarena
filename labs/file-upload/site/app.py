"""Vulnerable upload app for file-upload lab — Python stdlib only."""
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import base64

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')

UPLOAD_DIR = '/tmp/uploads'
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Blacklist of "dangerous" extensions (easily bypassed)
BLOCKED_EXTENSIONS = ['.php', '.exe', '.sh', '.bat', '.cmd', '.ps1']

# Pre-planted files for discovery
with open(f'{UPLOAD_DIR}/flag_level1.txt', 'w') as f: f.write(f'Level 1 accessible: {FLAG_1}')
with open(f'{UPLOAD_DIR}/flag_level2.txt', 'w') as f: f.write(f'Level 2 accessible: {FLAG_2}')
with open(f'{UPLOAD_DIR}/.env', 'w') as f: f.write(f'DB_PASSWORD={FLAG_3}')


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/upload':
            self.send_html(UPLOAD_FORM)
        elif path == '/files':
            self.handle_files()
        elif path.startswith('/files/'):
            self.handle_download(path)
        else:
            self.send_html(NOT_FOUND, 404)

    def do_POST(self):
        if self.path == '/upload':
            self.handle_upload()
        else:
            self.send_html(NOT_FOUND, 404)

    def handle_upload(self):
        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            self.send_html(UPLOAD_ERROR.format(msg='Use multipart/form-data'), 400)
            return

        # Parse multipart body (simplified for lab)
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8', errors='replace')

        # Extract filename from Content-Disposition
        filename_match = re.search(r'filename="([^"]+)"', body)
        if not filename_match:
            self.send_html(UPLOAD_ERROR.format(msg='No filename found'), 400)
            return

        filename = filename_match.group(1)

        # VULNERABLE: blacklist approach (should be allowlist)
        for ext in BLOCKED_EXTENSIONS:
            if filename.lower().endswith(ext):
                self.send_html(UPLOAD_BLOCKED.format(
                    filename=filename, ext=ext,
                    hint='Try: double extension (file.php.txt), case change (file.PHP), null byte'))
                return

        # VULNERABLE: no content-type validation
        # VULNERABLE: no size limit
        # VULNERABLE: path traversal possible if filename contains ../

        # Save file
        safe_name = os.path.basename(filename)  # Basic path traversal protection
        filepath = os.path.join(UPLOAD_DIR, safe_name)
        try:
            # Extract file content (simplified: everything after the last boundary)
            parts = body.split('------')
            content = parts[-2] if len(parts) > 2 else body
            with open(filepath, 'w') as f:
                f.write(content)
            self.send_html(UPLOAD_OK.format(filename=safe_name))
        except Exception as e:
            self.send_html(UPLOAD_ERROR.format(msg=str(e)), 500)

    def handle_files(self):
        try:
            files = os.listdir(UPLOAD_DIR)
            file_list = ''.join(
                f'<li><a href="/files/{f}" style="color:#58a6ff">{f}</a></li>'
                for f in sorted(files)
            )
            self.send_html(FILES_LIST.format(files=file_list))
        except Exception:
            self.send_html(UPLOAD_ERROR.format(msg='Error listing'), 500)

    def handle_download(self, path):
        filename = os.path.basename(path)
        filepath = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                content = f.read()
            self.send_html(FILE_VIEW.format(filename=filename, content=content))
        else:
            self.send_html(NOT_FOUND, 404)

    def send_html(self, html, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())

    def log_message(self, format, *args):
        pass


WELCOME = """<!DOCTYPE html>
<html><head><title>FileShare</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>📁 FileShare</h1>
<p>Upload and share files with your team.</p>
<ul>
<li><a href="/upload" style="color:#58a6ff">Upload a file</a></li>
<li><a href="/files" style="color:#58a6ff">Browse files</a></li>
</ul>
</body></html>"""

UPLOAD_FORM = """<!DOCTYPE html>
<html><head><title>Upload</title></head>
<body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>📤 Upload File</h1>
<form action="/upload" method="POST" enctype="multipart/form-data">
<input type="file" name="file" style="background:#161b22;color:#c9d1d9;border:1px solid #30363d;padding:8px">
<button style="background:#238636;color:#fff;padding:8px 16px;border:none">Upload</button>
</form>
<p style="color:#d29922;font-size:12px">Blocked: .php .exe .sh .bat .cmd .ps1</p>
</body></html>"""

UPLOAD_OK = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#7ee787">
<h1>✅ Uploaded: {filename}</h1>
<p><a href="/files" style="color:#58a6ff">View files</a></p>
</body></html>"""

UPLOAD_BLOCKED = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>❌ Blocked: {filename}</h1>
<p>Extension {ext} is not allowed.</p>
<p style="color:#d29922;font-size:12px">{hint}</p>
</body></html>"""

UPLOAD_ERROR = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#f85149">
<h1>Upload Error</h1><p>{msg}</p>
</body></html>"""

FILES_LIST = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>📁 Files</h1>
<ul>{files}</ul>
<a href="/upload" style="color:#58a6ff">Upload another</a>
</body></html>"""

FILE_VIEW = """<!DOCTYPE html>
<html><body style="font-family:monospace;padding:40px;background:#0d1117;color:#c9d1d9">
<h1>📄 {filename}</h1>
<pre style="background:#161b22;padding:20px;border-radius:8px;overflow-x:auto">{content}</pre>
<a href="/files" style="color:#58a6ff">&larr; Back to files</a>
</body></html>"""

NOT_FOUND = """<html><body><h1>404</h1></body></html>"""

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 8080), Handler)
    print(f'File upload lab running on :8080')
    server.serve_forever()
