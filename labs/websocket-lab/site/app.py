"""WebSocket security lab: raw RFC 6455 server (asyncio, stdlib only).

A group chat with two classic WebSocket holes:
  1. Message injection — the server trusts the client-supplied "from" field
  2. No auth/Origin check on the internal /admin socket (CSWSH-style)
"""
import asyncio
import base64
import hashlib
import json
import os
import struct
from urllib.parse import urlparse, parse_qs

F = {i + 1: os.environ.get(f'FLAG_{i + 1}', 'FLAG{p}') for i in range(2)}
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

HISTORY = [
    {'from': 'system', 'text': 'channel #general — 3 users online'},
    {'from': 'alice', 'text': 'the deploy pipeline is green again'},
    {'from': 'admin', 'text': 'reminder: audit review at 15:00'},
]
CLIENTS = set()
ACHIEVEMENTS = []


class PeekReader:
    """Wraps a StreamReader, replaying one pre-read first line."""

    def __init__(self, inner: asyncio.StreamReader, first: bytes):
        self.inner = inner
        self.pending = first

    async def readline(self):
        if self.pending is not None:
            line, self.pending = self.pending, None
            return line
        return await self.inner.readline()

    async def readexactly(self, n):
        return await self.inner.readexactly(n)


def encode_frame(text: str) -> bytes:
    payload = text.encode()
    if len(payload) < 126:
        header = struct.pack('>BB', 0x81, len(payload))
    elif len(payload) < 65536:
        header = struct.pack('>BBH', 0x81, 126, len(payload))
    else:
        header = struct.pack('>BBQ', 0x81, 127, len(payload))
    return header + payload


async def read_frame(reader: PeekReader):
    head = await reader.readexactly(2)
    opcode = head[0] & 0x0F
    masked = bool(head[1] & 0x80)
    length = head[1] & 0x7F
    if length == 126:
        length = struct.unpack('>H', await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack('>Q', await reader.readexactly(8))[0]
    mask = await reader.readexactly(4) if masked else b'\0\0\4\0'
    payload = bytearray(await reader.readexactly(length))
    if masked:
        for i in range(length):
            payload[i] ^= mask[i % 4]
    if opcode == 0x8:
        return None
    if opcode == 0x9:
        return 'PING'
    return payload.decode('utf-8', 'replace')


async def send(writer: asyncio.StreamWriter, obj) -> None:
    writer.write(encode_frame(json.dumps(obj)))
    await writer.drain()


async def upgrade(reader: PeekReader, writer) -> dict:
    """Finish reading request headers, reply 101, return the headers."""
    headers = {}
    while True:
        line = await reader.readline()
        if line in (b'\r\n', b'\n', b''):
            break
        k, _, v = line.decode('latin1').partition(':')
        headers[k.strip().lower()] = v.strip()
    key = headers.get('sec-websocket-key', '')
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    writer.write((
        'HTTP/1.1 101 Switching Protocols\r\n'
        'Upgrade: websocket\r\n'
        'Connection: Upgrade\r\n'
        f'Sec-WebSocket-Accept: {accept}\r\n'
        f'X-Seen-Origin: {headers.get("origin", "none")}\r\n'
        '\r\n'
    ).encode())
    await writer.drain()
    return headers


async def chat_session(reader: PeekReader, writer, path: str) -> None:
    qs = parse_qs(urlparse(path).query)
    user = qs.get('user', ['anonymous'])[0]
    await upgrade(reader, writer)
    CLIENTS.add(writer)
    try:
        await send(writer, {'type': 'history', 'messages': HISTORY})
        await send(writer, {'type': 'system', 'text': f'connected as {user}'})
        while True:
            text = await read_frame(reader)
            if text is None:
                break
            if text == 'PING':
                continue
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                await send(writer, {'type': 'error', 'text': 'send JSON: {"text": "..."}'})
                continue
            # VULNERABLE: "from" comes from the client, not from the session
            outgoing = {'type': 'message', 'from': msg.get('from', user), 'text': msg.get('text', '')}
            if msg.get('from') and msg.get('from') != user:
                ACHIEVEMENTS.append({'type': 'SPOOFED_SENDER', 'from': msg.get('from')})
                await send(writer, {'type': 'system',
                                    'text': 'server accepted your forged sender',
                                    'flag': F[1]})
            for peer in list(CLIENTS):
                try:
                    await send(peer, outgoing)
                except (ConnectionError, RuntimeError):
                    CLIENTS.discard(peer)
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        CLIENTS.discard(writer)
        writer.close()


async def admin_session(reader: PeekReader, writer) -> None:
    """Internal endpoint: no token, no Origin validation."""
    await upgrade(reader, writer)
    try:
        await send(writer, {'type': 'system', 'text': 'admin console (internal)',
                            'hint': '{"cmd": "dump"}'})
        while True:
            text = await read_frame(reader)
            if text is None:
                break
            if text == 'PING':
                continue
            try:
                msg = json.loads(text)
            except json.JSONDecodeError:
                continue
            if msg.get('cmd') == 'dump':
                ACHIEVEMENTS.append({'type': 'ADMIN_SOCKET_NO_AUTH'})
                await send(writer, {'type': 'dump', 'flag': F[2],
                                    'users': ['alice', 'bob', 'admin']})
            else:
                await send(writer, {'type': 'error', 'text': f'unknown cmd {msg.get("cmd")}'})
    except (ConnectionError, asyncio.IncompleteReadError):
        pass
    finally:
        writer.close()


async def http_status(reader: PeekReader, writer) -> None:
    while (await reader.readline()) not in (b'\r\n', b'\n', b''):
        pass
    body = json.dumps({
        'service': 'ws-chat',
        'connect': 'websocat "ws://127.0.0.1:18110/chat?user=you"',
        'admin_internal': 'ws://127.0.0.1:18110/admin',
        'achievements': ACHIEVEMENTS[-5:],
    }, indent=2)
    writer.write(('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n'
                  + body).encode())
    await writer.drain()
    writer.close()


async def router(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    peek = PeekReader(reader, None)
    try:
        first = await peek.readline()
        peek.pending = first
        method, path, _ = first.decode('latin1').split()
        if path.startswith('/chat'):
            await chat_session(peek, writer, path)
        elif path.startswith('/admin'):
            await admin_session(peek, writer)
        else:
            await http_status(peek, writer)
    except (ConnectionError, asyncio.IncompleteReadError, ValueError):
        writer.close()


async def main() -> None:
    server = await asyncio.start_server(router, '0.0.0.0', 8080)
    print('[ws-lab] listening on :8080', flush=True)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    asyncio.run(main())
