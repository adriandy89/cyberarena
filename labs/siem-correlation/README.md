# Lab siem-correlation

Room: **seguridad-soluciones** (task adicional, Tier 2). Correlación multi-fuente.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18107
```

| Endpoint | Contenido |
|---|---|
| `/logs/firewall` | fw01 — scan, conexiones, callbacks C2 |
| `/logs/auth` | sshd/sudo/cron/useradd |
| `/logs/web` | nginx access log |
| `/correlate?ip=&time=&persistence=` | valida la reconstrucción |

## Flags
1. IP del atacante (presente en las 3 fuentes)
2. Timestamp del exploit (command injection en /api/v1/ping)
3. Mecanismo de persistencia (root)
