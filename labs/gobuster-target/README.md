# Lab gobuster-target

Room: **web-hacking-basico** (CS101). Web corporativa con 12 directorios ocultos.

## Uso
```bash
# Fuzzing con gobuster/ffuf
gobuster dir -u http://127.0.0.1:18089 -w /usr/share/wordlists/dirb/common.txt

# O con ffuf
ffuf -w /usr/share/wordlists/dirb/common.txt -u http://127.0.0.1:18089/FUZZ

# O simplemente probar rutas comunes
curl http://127.0.0.1:18089/admin
curl http://127.0.0.1:18089/backup/db.sql
curl http://127.0.0.1:18089/dev/index.html
```

## Flags
- FLAG_1 — en /admin (200 OK)
- FLAG_2 — en /backup/db.sql (200 OK, requiere 2 niveles de discovery)
- FLAG_3 — en /dev/index.html (requiere seguir redirect 301 de /dev)
