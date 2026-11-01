# Lab privesc-linux-1

Room: **privesc-linux** (JrPT). Un Linux REAL con 4 misconfiguraciones para escalar.

## Despliegue

```bash
cp flags.env.example flags.env
docker compose -f labs/privesc-linux-1/compose.yaml --env-file labs/privesc-linux-1/flags.env up -d
# Entrar como usuario limitado:
docker exec -it lab-privesc-linux-1-shell-1 su - student
```

## Vectores de escalada

| # | Vector | Cómo |
|---|---|---|
| 1 | Root-only file | Necesitas ser root para leer /root/flag1.txt |
| 2 | SUID find | `find / -perm -4000` → usar find -exec para leer flag2 |
| 3 | sudo vim | `sudo -l` → `sudo vim -c ':!cat /opt/flag3_sudo.txt'` |
| 4 | Cron writable | Escribir reversa shell en /opt/scripts/backup.sh |

## Flags
- `FLAG_1` — en /root (requiere root total)
- `FLAG_2` — via SUID find
- `FLAG_3` — via sudo vim
- `FLAG_4` — via cron script writable
