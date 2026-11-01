"""Multi-port TCP server for nmap practice — realistic service banners + flags."""
import os
import socket
import threading

FLAG_1 = os.environ.get('FLAG_1', 'FLAG{p}')
FLAG_2 = os.environ.get('FLAG_2', 'FLAG{p}')
FLAG_3 = os.environ.get('FLAG_3', 'FLAG{p}')
FLAG_4 = os.environ.get('FLAG_4', 'FLAG{p}')

# Service definitions: port -> banner, flag (or None)
SERVICES = {
    8021: {
        'banner': '220 FTP Server (vsftpd 3.0.3)\r\n',
        'data': f'Welcome to FTP.\r\nYour flag: {FLAG_1}\r\nType HELP for commands.\r\n',
        'name': 'FTP'
    },
    8022: {
        'banner': 'SSH-2.0-OpenSSH_8.9p1 Ubuntu\r\n',
        'data': f'Debug: internal_key={FLAG_2}\r\n',
        'name': 'SSH'
    },
    8080: {
        'banner': '',
        'data': f'HTTP/1.1 200 OK\r\nServer: Apache/2.4.54\r\n\r\n<h1>Welcome</h1><p>{FLAG_3}</p>',
        'name': 'HTTP'
    },
    8443: {
        'banner': '',
        'data': f'HTTP/1.1 200 OK\r\nServer: nginx/1.24\r\nX-Internal: true\r\n\r\n{{"service":"internal-api","flag":"{FLAG_4}"}}',
        'name': 'HTTPS'
    },
    3306: {
        'banner': '',
        'data': 'mysql_native_password\r\n8.0.36 MySQL Community Server\r\n',
        'name': 'MySQL'
    },
    6379: {
        'banner': '',
        'data': '-ERR unknown command\r\nRedis server v7.2\r\n',
        'name': 'Redis'
    },
    9001: {
        'banner': '',
        'data': 'Supervisorctl v4.2\r\nNo auth required.\r\n',
        'name': 'Supervisor'
    },
}


def handle_client(conn, addr, port, config):
    """Handle a client connection to a specific port."""
    try:
        # Send banner if defined
        if config['banner']:
            conn.sendall(config['banner'].encode())
        # Send data
        conn.sendall(config['data'].encode())
        # Keep connection alive briefly to let scanner read
        import time
        time.sleep(0.5)
    except Exception:
        pass
    finally:
        conn.close()


def start_service(port, config):
    """Start a TCP listener on a specific port."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', port))
    server.listen(5)
    print(f'[{config["name"]}] listening on :{port}')

    while True:
        conn, addr = server.accept()
        t = threading.Thread(target=handle_client, args=(conn, addr, port, config))
        t.daemon = True
        t.start()


if __name__ == '__main__':
    print('Nmap playground starting...')
    print('Services:')
    for port, cfg in sorted(SERVICES.items()):
        print(f'  :{port} ({cfg["name"]})')

    threads = []
    for port, config in SERVICES.items():
        t = threading.Thread(target=start_service, args=(port, config), daemon=True)
        t.start()
        threads.append(t)

    # Keep alive
    import time
    while True:
        time.sleep(60)
