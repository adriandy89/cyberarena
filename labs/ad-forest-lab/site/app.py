"""AD forest lab: simulated LDAP/Kerberos/ADCS/trust (stdlib).

Simulates the advanced AD attack surface of a two-domain forest with the
same request shapes the real tools use (ldapsearch filters, Rubeus-like
s4u requests, Certipy-like cert enrollment, trust enumeration).
"""
import json
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(4)}

USERS = [
    {'sam': 'administrator', 'dn': 'CN=Administrator,CN=Users,DC=corp,DC=local', 'spn': None, 'admin': True},
    {'sam': 'sqlsvc', 'dn': 'CN=SQL Service,CN=Users,DC=corp,DC=local', 'spn': 'MSSQLSvc/db01.corp.local:1433', 'admin': False},
    {'sam': 'websvc', 'dn': 'CN=Web Service,CN=Users,DC=corp,DC=local', 'spn': 'HTTP/web.corp.local', 'admin': False},
    {'sam': 'helpdesk', 'dn': 'CN=Helpdesk L1,OU=Support,DC=corp,DC=local', 'spn': None, 'admin': False},
    {'sam': 'svc-backup', 'dn': 'CN=Backup Service,OU=Service,DC=corp,DC=local',
     'spn': 'BACKUP/file01.corp.local', 'admin': False,
     'note': f'kerberoastable-with-weak-password: {F[1]}'},
]

CERT_TEMPLATES = [
    {'name': 'User', 'enroll': 'Domain Users', 'san': 'subject', 'esc': None},
    {'name': 'Machine', 'enroll': 'Domain Computers', 'san': 'subject', 'esc': None},
    {'name': 'CorpWebServer', 'enroll': 'Domain Users', 'san': 'requester', 'esc': 'ESC1',
     'note': 'ENROLLEE_SUPPLIES_SUBJECT + Domain Users can enroll'},
    {'name': 'SmartcardLogon', 'enroll': 'Domain Users', 'san': 'ca-defined', 'esc': None},
]

TRUSTS = [
    {'source': 'corp.local', 'target': 'dev.corp.local', 'type': 'parent-child', 'transitive': True,
     'sid_filtering': False, 'note': 'SID History not quarantined'},
    {'source': 'corp.local', 'target': 'partner.external', 'type': 'external', 'transitive': False,
     'bidirectional': True, 'note': f'bidirectional external trust: {F[4]}'},
]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        path = parsed.path

        if path == '/':
            self.send_html(WELCOME)
        elif path == '/ldap/query':
            self.handle_ldap(params)
        elif path == '/kerberos/s4u':
            self.handle_s4u(params)
        elif path == '/kerberoast':
            self.handle_kerberoast(params)
        elif path == '/adcs/templates':
            self.send_json({'templates': CERT_TEMPLATES})
        elif path == '/adcs/enroll':
            self.handle_enroll(params)
        elif path == '/trust':
            self.send_json({'trusts': TRUSTS})
        else:
            self.send_json({'error': 404}, 404)

    def handle_ldap(self, params):
        """LDAP query with filter injection: (samAccountName=x) is escapable."""
        filt = params.get('filter', [''])[0]
        m = re.search(r'samAccountName=([\w*-]+)', filt)
        if not m:
            self.send_json({'entries': USERS, 'note': 'no filter — anonymous dump (real AD: NULL session)'})
            return
        sam = m.group(1)
        # VULNERABLE: wildcard/truncation not escaped -> '*' matches everyone
        results = [u for u in USERS if re.fullmatch(sam.replace('*', '.*'), u['sam'])]
        if not results:
            self.send_json({'entries': [], 'note': '0 entries'})
        elif len(results) == 1 and results[0].get('note'):
            self.send_json({'entries': results, 'flag': F[2],
                            'note': 'filter matched an account with a comment you should not see'})
        else:
            self.send_json({'entries': results})

    def handle_kerberoast(self, params):
        """Request a service ticket for an SPN (weak service password cracks offline)."""
        spn = params.get('spn', [''])[0]
        user = next((u for u in USERS if u['spn'] and u['spn'].lower().startswith(spn.lower())), None)
        if user and 'weak' in user.get('note', ''):
            self.send_json({
                'spn': user['spn'], 'sam': user['sam'],
                'ticket': '$krb5tgs$23$*svc-backup$CORP.LOCAL$...',
                'cracked': 'Summer2026!',
                'flag': F[1],
                'note': 'RC4 ticket cracks in seconds with hashcat mode 13100',
            })
        elif user:
            self.send_json({'spn': user['spn'], 'sam': user['sam'],
                            'ticket': '$krb5tgs$18$...' , 'note': 'AES256 ticket — strong password, no crack'})
        else:
            self.send_json({'error': 'no SPN matched'}, 404)

    def handle_s4u(self, params):
        """Constrained delegation abuse (S4U2Proxy as admin)."""
        target = params.get('impersonate', [''])[0]
        delegate = params.get('as', [''])[0]
        if delegate == 'administrator':
            # only works if a delegated account was compromised first
            has_ticket = params.get('ticket', [''])[0].startswith('$krb5tgs')
            if has_ticket and target == 'administrator':
                self.send_json({'status': 'S4U2Proxy ok', 'impersonated': 'administrator',
                                'flag': F[3],
                                'note': 'svc-backup had AllowedToDelegateTo cifs/file01'})
            else:
                self.send_json({'error': 'need a valid TGS of a delegated account (kerberoast first)'},
                               403)
        else:
            self.send_json({'error': 'specify ?as=administrator'}, 400)

    def handle_enroll(self, params):
        """ADCS enrollment: ESC1 = requester-supplied SAN."""
        template = params.get('template', [''])[0]
        san = params.get('san', [''])[0]
        tpl = next((t for t in CERT_TEMPLATES if t['name'].lower() == template.lower()), None)
        if not tpl:
            self.send_json({'error': 'unknown template — enumerate /adcs/templates'}, 404)
            return
        if tpl.get('esc') == 'ESC1' and san == 'administrator@corp.local':
            self.send_json({'status': 'certificate issued', 'template': tpl['name'],
                            'san': san, 'flag': F[3],
                            'note': 'ESC1: you just got a cert authenticating as administrator'})
        elif tpl.get('esc') == 'ESC1':
            self.send_json({'status': 'certificate issued', 'template': tpl['name'], 'san': san or 'requester',
                            'hint': 'this template lets YOU choose the SAN. Who do you want to be?'})
        else:
            self.send_json({'status': 'certificate issued', 'template': tpl['name'],
                            'san': 'requester', 'note': 'SAN fixed by CA — no privilege here'})

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
<h1>&#127963; corp.local / dev.corp.local</h1>
<p>Simulated AD attack surface (same request shapes as the real tools):</p>
<ul>
<li><a href="/kerberoast?spn=svc-backup" style="color:#58a6ff">/kerberoast?spn=X</a> &mdash; request TGS (hashcat -m 13100 offline)</li>
<li><a href="/ldap/query?filter=(samAccountName=svc-backup)" style="color:#58a6ff">/ldap/query?filter=...</a> &mdash; filter injection: try samAccountName=svc-*</li>
<li><a href="/adcs/templates" style="color:#58a6ff">/adcs/templates</a> &mdash; find the ESC1, then /adcs/enroll?template=...&amp;san=...</li>
<li><a href="/kerberos/s4u?as=administrator&amp;ticket=$krb5tgs$..." style="color:#58a6ff">/kerberos/s4u</a> &mdash; delegation abuse with a stolen TGS</li>
<li><a href="/trust" style="color:#58a6ff">/trust</a> &mdash; forest trusts</li>
</ul>
</body></html>"""

if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
