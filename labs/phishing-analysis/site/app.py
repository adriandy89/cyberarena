"""Phishing analysis lab: .eml forensics, headers, SPF, attachments."""
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(4)}

# Simulated DNS TXT records for SPF analysis
SPF_RECORDS = {
    'banco-seguro.com': 'v=spf1 include:_spf.google.com include:mailgun.org -all',
    'corp-supplies.cn': 'v=spf1 +all',
    'github.com': 'v=spf1 include:spf.github.com -all',
}

EMAILS = {}

def build_emails():
    """Three raw .eml files: one legit, two phishing with different tells."""
    EMAILS['01-nomina.eml'] = f"""Return-Path: <noreply@banco-seguro.com>
Delivered-To: empleado@corp.local
Received: from mailer.banco-seguro.com (mailer.banco-seguro.com [203.0.113.10])
        by mx.corp.local with ESMTPS id 4XY1
Authentication-Results: mx.corp.local;
        spf=pass (sender IP is 203.0.113.10) smtp.mailfrom=banco-seguro.com;
        dkim=pass header.d=banco-seguro.com;
        dmarc=pass header.from=banco-seguro.com
From: "Banco Seguro" <noreply@banco-seguro.com>
To: empleado@corp.local
Subject: Tu nomina de noviembre esta disponible
Date: Fri, 31 Oct 2026 09:12:00 +0100
Message-ID: <20261031@mailer.banco-seguro.com>
Content-Type: text/plain; charset=utf-8

Hola,

Tu nomina de noviembre ya esta disponible en la banca online.
Accede desde la app movil o desde nuestra web oficial.

Un saludo,
Banco Seguro
"""
    EMAILS['02-urgente.eml'] = f"""Return-Path: <bounce@corp-supplies.cn>
Delivered-To: empleado@corp.local
Received: from unknown (HELO mail.banco-seguro.com) ([198.51.100.66])
        by mx.corp.local with SMTP id 9ZZ7
Authentication-Results: mx.corp.local;
        spf=none smtp.mailfrom=corp-supplies.cn;
        dkim=none;
        dmarc=fail (p=none) header.from=banco-seguro.com
From: "Banco Seguro" <seguridad@banco-seguro.com>
Reply-To: soporte.it.2026@mail.ru
To: empleado@corp.local
Subject: URGENTE: cuenta bloqueada por actividad inusual
Date: Fri, 31 Oct 2026 14:47:12 +0100
Message-ID: <abc123@corp-supplies.cn>
X-Mailer: PHPMailer 6.8
Content-Type: multipart/mixed; boundary="BM"

--BM
Content-Type: text/html; charset=utf-8

<html><body>
<p>Estimado cliente,</p>
<p>Hemos detectado un intento de acceso no autorizado. Tu cuenta queda
<b>suspendida 24h</b> salvo verificacion inmediata.</p>
<p><a href="http://banco-seguro.com.verify-login.cn:8080/session?id=empleado@corp.local">
Haz clic aqui para verificar tu cuenta</a></p>
<p>Si no lo haces, la cuenta sera eliminada permanentemente.</p>
</body></html>

--BM
Content-Type: application/zip; name="Detalles_de_la_incidencia.zip"
Content-Disposition: attachment; filename="Detalles_de_la_incidencia.zip"
Content-Transfer-Encoding: base64

UEsDBAoAAAAAAA{{TRUNCATED_ZIP}}

--BM--
"""
    EMAILS['03-oferta.eml'] = f"""Return-Path: <jobs@realcareers.example>
Delivered-To: empleado@corp.local
Received: from mtaproxy.hiring-mail.net (mtaproxy.hiring-mail.net [203.0.113.55])
        by mx.corp.local with ESMTPS id 7QQ2
Authentication-Results: mx.corp.local;
        spf=pass smtp.mailfrom=realcareers.example;
        dkim=pass;
        dmarc=pass header.from=realcareers.example
From: "RealCareers" <jobs@realcareers.example>
To: empleado@corp.local
Subject: 12 vacantes de seguridad en tu ciudad
Date: Fri, 31 Oct 2026 16:02:00 +0100
Content-Type: text/plain; charset=utf-8

Buenas,

Publicamos 12 vacatas de analista SOC junior. Sin experiencia requerida:
aplica en https://realcareers.example/jobs.

-- 
RealCareers
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/emails':
            self.send_json({'emails': list(EMAILS.keys())})
        elif path.startswith('/emails/'):
            name = path.split('/')[-1]
            body = EMAILS.get(name)
            if body is None:
                self.send_json({'error': 'unknown email'}, 404)
                return
            self.send_response(200)
            self.send_header('Content-Type', 'message/rfc822; charset=utf-8')
            self.end_headers()
            self.wfile.write(body.encode())
        elif path == '/check-spf':
            domain = params.get('domain', [''])[0].lower()
            record = SPF_RECORDS.get(domain)
            if record is None:
                self.send_json({'error': 'no SPF record found', 'hint': 'try /check-spf?domain=corp-supplies.cn'})
                return
            verdict = {'domain': domain, 'record': record}
            if '+all' in record:
                verdict['analysis'] = 'SPF policy is +all: ANY server may send as this domain — meaningless'
                verdict['flag'] = F[4]
            elif '-all' in record:
                verdict['analysis'] = 'SPF hard-fail: only listed senders allowed (healthy)'
            else:
                verdict['analysis'] = 'SPF soft policy'
            self.send_json(verdict)
        elif path == '/verify':
            self.handle_verify(params)
        else:
            self.send_html('<h1>404</h1>', 404)

    def handle_verify(self, params):
        """Analyst submits findings: each correct key unlocks its flag."""
        origin = params.get('origin', [''])[0].strip().lower()
        url = params.get('url', [''])[0].strip().lower()
        attachment = params.get('attachment', [''])[0].strip().lower()
        result = {}

        # The real origin: Return-Path domain (the HELO lied about banco-seguro)
        if origin == 'corp-supplies.cn':
            result['origin'] = {'correct': True, 'flag': F[1],
                                'note': 'Return-Path and Message-ID betray the real sender; HELO spoofed banco-seguro.com'}
        elif origin:
            result['origin'] = {'correct': False,
                                'hint': 'Check Return-Path and Message-ID — the HELO lies'}
        # The phishing URL: the href behind "verify your account"
        if url == 'banco-seguro.com.verify-login.cn:8080' or 'verify-login.cn' in url:
            result['url'] = {'correct': True, 'flag': F[2],
                             'note': 'Real domain is verify-login.cn; banco-seguro.com is a subdomain disguise'}
        elif url:
            result['url'] = {'correct': False,
                             'hint': 'The href is not what the visible text says — right-click > copy link'}
        # The malicious attachment name
        if 'detalles' in attachment and attachment.endswith('.zip'):
            result['attachment'] = {'correct': True, 'flag': F[3],
                                    'note': 'Zip attachments with urgent pretext = classic malware dropper'}
        elif attachment:
            result['attachment'] = {'correct': False,
                                   'hint': 'Look at Content-Disposition in part 2 of the MIME'}

        result['summary'] = 'submit ?origin=&url=&attachment= with your findings'
        self.send_json(result)

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
<h1>&#128231; Phishing Forensics</h1>
<p>You are the SOC analyst. Three emails reached empleado@corp.local. Analyze them.</p>
<ul>
<li><a href="/emails" style="color:#58a6ff">/emails</a> &mdash; inbox listing</li>
<li><a href="/emails/01-nomina.eml" style="color:#58a6ff">/emails/01-nomina.eml</a> &mdash; payroll notice</li>
<li><a href="/emails/02-urgente.eml" style="color:#58a6ff">/emails/02-urgente.eml</a> &mdash; URGENT account blocked</li>
<li><a href="/emails/03-oferta.eml" style="color:#58a6ff">/emails/03-oferta.eml</a> &mdash; job offers</li>
<li><a href="/check-spf?domain=banco-seguro.com" style="color:#58a6ff">/check-spf?domain=X</a> &mdash; SPF record lookup</li>
<li><a href="/verify" style="color:#58a6ff">/verify</a> &mdash; submit findings (?origin=&amp;url=&amp;attachment=)</li>
</ul>
<p style="color:#d29922;font-size:12px">TIP: curl the .eml files and read headers top to bottom: Return-Path, Received, Authentication-Results.</p>
</body></html>"""

if __name__ == '__main__':
    build_emails()
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
