"""Fake dockerd for the container-escape lab.

Listens on /var/run/docker.sock and speaks the real Docker Engine API
(HTTP over unix socket) well enough for curl --unix-socket workflows:

  GET  /version                          -> host info (recon)
  GET  /containers/json                  -> host containers (recon)
  POST /containers/create                -> accepts privileged + host binds
  POST /containers/<id>/start            -> "starts" it
  GET  /containers/<id>/logs             -> host secrets (the escape payoff)

No real containers are created: the student trains the ESCAPE TECHNIQUE
(curl against the socket) with zero risk to their machine.
"""
import json
import os
import socket
import socketserver
import threading

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(3)}

SOCKET_PATH = '/var/run/docker.sock'
CONTAINERS = {
    'a1b2c3d4e5f6': {'name': '/prod-web', 'image': 'corp/web:2026.10', 'state': 'running'},
    'f6e5d4c3b2a1': {'name': '/prod-db', 'image': 'postgres:18', 'state': 'running'},
    '0987654321ab': {'name': '/watchtower', 'image': 'containrrr/watchtower', 'state': 'running'},
}
ESCAPED = {}   # id -> created container


class HttpUnixHandler(socketserver.StreamRequestHandler):
    def handle(self):
        try:
            request = self.rfile.readline().decode('latin1')
            if not request:
                return
            method, path, _ = request.split()
            length = 0
            while True:
                line = self.rfile.readline()
                if line in (b'\r\n', b'\n', b''):
                    break
                k, _, v = line.decode('latin1').partition(':')
                if k.strip().lower() == 'content-length':
                    length = int(v.strip())
            body = self.rfile.read(length) if length else b''

            status, payload = self.route(method, path, body)
            response = json.dumps(payload, indent=2).encode()
            self.wfile.write(
                f'HTTP/1.1 {status}\r\nContent-Type: application/json\r\n'
                f'Content-Length: {len(response)}\r\nApi-Version: 1.47\r\n'
                f'Docker-Experimental: false\r\n\r\n'.encode() + response)
        except Exception:
            pass

    def route(self, method, path, body):
        if path == '/version' and method == 'GET':
            return 200, {'Version': '27.3.1', 'Api-Version': '1.47', 'Os': 'linux',
                         'KernelVersion': '6.8.0-generic (HOST)',
                         # recon confirmed: this socket controls the HOST daemon
                         'flag': F[1],
                         'note': 'you are talking to the HOST daemon: total control'}
        if path == '/containers/json' and method == 'GET':
            return 200, [{'Id': cid, 'Names': [c['name']], 'Image': c['image'], 'State': c['state']}
                         for cid, c in CONTAINERS.items()]
        if path == '/containers/create' and method == 'POST':
            spec = json.loads(body or b'{}')
            privileged = bool(spec.get('HostConfig', {}).get('Privileged'))
            binds = spec.get('HostConfig', {}).get('Binds') or []
            mounts_host = any(b.startswith('/:') or b == '/' for b in binds)
            if privileged and mounts_host:
                cid = 'esc' + os.urandom(3).hex()
                ESCAPED[cid] = {'spec': spec, 'state': 'created'}
                return 201, {'Id': cid, 'Warnings': [
                    f'privileged=true with host bind mounts: {F[2]}']}
            if privileged or mounts_host:
                return 201, {'Id': 'ctr' + os.urandom(3).hex(), 'Warnings': [
                    'half way: you need BOTH privileged AND a host bind to own the host']}
            return 201, {'Id': 'ctr' + os.urandom(3).hex(), 'Warnings': [
                'plain container — how does this help you escape?']}
        if path.startswith('/containers/') and path.endswith('/start') and method == 'POST':
            cid = path.split('/')[2]
            if cid in ESCAPED:
                ESCAPED[cid]['state'] = 'running'
                return 204, {}
            return 404, {'message': 'no such container'}
        if path.startswith('/containers/') and path.endswith('/logs') and method == 'GET':
            cid = path.split('/')[2]
            if cid in ESCAPED:
                return 200, {'logs': '[host-root] cat /flag/host-secret.txt:',
                             'flag': F[3],
                             'note': 'you read a HOST file from your escape container'}
            return 404, {'message': 'no such container (create + start your escape first)'}
        if path == '/_ping':
            return 200, 'OK'
        return 404, {'message': f'no route {method} {path}'}


class UnixHttpServer(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    if os.path.exists(SOCKET_PATH):
        os.unlink(SOCKET_PATH)
    os.makedirs(os.path.dirname(SOCKET_PATH), exist_ok=True)
    server = UnixHttpServer(SOCKET_PATH, HttpUnixHandler)
    os.chmod(SOCKET_PATH, 0o660)
    print('[fake-dockerd] listening on /var/run/docker.sock', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
