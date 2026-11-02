"""Cloud IAM lab: simulated AWS with the classic misconfigurations.

Mirrors real AWS paths under /aws/* so the room can teach the actual
169.254.169.254 workflow while staying local:
  - IMDSv1-style metadata with long-lived role credentials
  - public S3 bucket with secrets
  - over-permissioned IAM policy (Action: "*")
"""
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(3)}

ROLE_CREDS = {
    'AccessKeyId': 'AKIA3XAMPLELONGTERM',
    'SecretAccessKey': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'Token': None,
    'Expiration': '2036-01-01T00:00:00Z',   # long-lived: the sin
    'arn': 'arn:aws:iam::123456789012:role/ec2-web-role',
}

S3_BUCKETS = {
    'corp-backups-prod': {'public': False, 'objects': ['db-2026-10-29.sql.gz', 'db-2026-10-30.sql.gz']},
    'corp-static-assets': {'public': False, 'objects': ['logo.png', 'app.js']},
    'corp-internal-tools': {'public': True, 'objects': ['terraform.tfstate', 'secrets.env', f'notes-{F[2]}.txt']},
}

TERRAFORM_TFSTATE = json.dumps({
    'version': 4,
    'outputs': {'db_password': {'value': 'Pr0dDB-SuperSecret-2026!'}},
    'resources': [{
        'type': 'aws_iam_user',
        'name': 'ci-deployer',
        'values': {'access_key_id': 'AKIA4LEGACYKEYZZZ',
                   'secret_access_key': 'v3ryS3cretCIKeyThatShouldNotBeHere'},
    }],
}, indent=2)

IAM_POLICIES = [
    {'name': 'ec2-web-role-policy', 'document': {
        'Statement': [{'Effect': 'Allow', 'Action': '*', 'Resource': '*'}]}},
    {'name': 'ci-deployer-policy', 'document': {
        'Statement': [{'Effect': 'Allow', 'Action': ['s3:GetObject'],
                       'Resource': 'arn:aws:s3:::corp-static-assets/*'}]}},
]

STS_VALIDATE = {'arn': ROLE_CREDS['arn'], 'assumed': True}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        routes = {
            '/': self.page_root,
            '/aws/latest/meta-data/': self.metadata_root,
            '/aws/latest/meta-data/iam/security-credentials/': self.metadata_role,
            '/aws/latest/meta-data/iam/security-credentials/ec2-web-role': self.metadata_creds,
            '/s3/corp-internal-tools/terraform.tfstate': self.s3_tfstate,
            '/s3/corp-internal-tools/secrets.env': self.s3_secrets,
            '/iam/policies': self.iam_policies,
            '/sts/assume?role=ec2-web-role': self.sts_assume,
        }
        handler = routes.get(path)
        if handler:
            handler()
        elif path == '/s3/buckets':
            self.s3_list()
        else:
            self.send_json({'error': '404', 'hint': 'start at /aws/latest/meta-data/'}, 404)

    def page_root(self):
        self.send_html(('''<html><body style="font-family:monospace;background:#0d1117;color:#c9d1d9;padding:40px">
<h1>&#9729; corp-workload (simulated AWS)</h1>
<p>You found an SSRF on the app. The cloud has three classic sins:</p>
<ul>
<li><a href="/aws/latest/meta-data/" style="color:#58a6ff">/aws/latest/meta-data/</a> &mdash; the IMDS (real path: 169.254.169.254)</li>
<li><a href="/s3/buckets" style="color:#58a6ff">/s3/buckets</a> &mdash; one of these is public</li>
<li><a href="/iam/policies" style="color:#58a6ff">/iam/policies</a> &mdash; check the wildcards</li>
</ul></body></html>''').encode())

    def metadata_root(self):
        self.send_text('iam/\nhostname\ninstance-id\n')

    def metadata_role(self):
        self.send_text('ec2-web-role\n')

    def metadata_creds(self):
        # F1: credentials harvested from IMDS + the tell (Expiration 10 years out)
        self.send_json({**ROLE_CREDS, 'note': 'IMDSv1: no token required',
                        'flag': F[1]})

    def s3_list(self):
        self.send_json({'buckets': [
            {'name': b, 'public': v['public'], 'objects': v['objects']}
            for b, v in S3_BUCKETS.items()]})

    def s3_tfstate(self):
        # F2 path 1: tfstate in a public bucket
        self.send_text(TERRAFORM_TFSTATE, code=200, ctype='application/json')

    def s3_secrets(self):
        # F2 path 2: secrets.env in a public bucket
        self.send_text(f'DB_HOST=prod-db.corp.internal\nDB_PASSWORD=Pr0dDB-SuperSecret-2026!\n# audit-tag: {F[2]}\n')

    def iam_policies(self):
        # F3: the wildcard policy is visible
        self.send_json({'policies': IAM_POLICIES,
                        'flag': F[3],
                        'note': 'Action "*" on Resource "*" attached to an instance role'})

    def sts_assume(self):
        self.send_json(STS_VALIDATE)

    def send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def send_text(self, text, code=200, ctype='text/plain'):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.end_headers()
        self.wfile.write(text.encode() if isinstance(text, str) else text)

    def send_html(self, body, code=200):
        self.send_text(body, code, 'text/html; charset=utf-8')

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()
