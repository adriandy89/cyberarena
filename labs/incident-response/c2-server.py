"""C2 holder for incident-response lab: accepts TCP, holds the session,
sends the flag banner once per connection."""
import os
import socket
import threading

FLAG_4 = os.environ.get('FLAG_4', 'FLAG{c2_connection_active}')


def handle(conn: socket.socket, addr) -> None:
    try:
        conn.sendall(f'* connection accepted\n* session: {addr[0]}\n* token: {FLAG_4}\n'.encode())
        # hold the session open like a real implant channel
        conn.recv(4096)
    except OSError:
        pass
    finally:
        conn.close()


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('0.0.0.0', 4444))
    server.listen(16)
    print('[c2] listening on :4444', flush=True)
    while True:
        conn, addr = server.accept()
        threading.Thread(target=handle, args=(conn, addr), daemon=True).start()


if __name__ == '__main__':
    main()
