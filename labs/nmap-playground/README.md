# Lab nmap-playground

Rooms: **recon-activo-escaneo** y **nmap-pro** (JrPT).

## Servicios (todos en la misma IP)

| Puerto | Servicio | Banner |
|---|---|---|
| 18085→8021 | FTP | vsftpd 3.0.3 |
| 8022 | SSH | OpenSSH 8.9p1 |
| 8080 | HTTP | Apache 2.4.54 |
| 8443 | HTTPS | nginx 1.24 |
| 3306 | MySQL | 8.0.36 |
| 6379 | Redis | v7.2 |
| 9001 | Supervisor | v4.2 |

Nota: el puerto 8021 está mapeado a 18085 en el host; los demás puertos son accesibles
directamente desde el contenedor.

## Uso
```bash
# Escanear los puertos publicados
nmap -sV -sC 127.0.0.1 -p 18085

# Banner grab con netcat
nc 127.0.0.1 18085
```

## Flags
- FLAG_1 — FTP banner
- FLAG_2 — SSH debug output
- FLAG_3 — HTTP body
- FLAG_4 — HTTPS JSON
