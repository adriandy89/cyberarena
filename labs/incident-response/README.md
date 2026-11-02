# Lab incident-response

Room: **defensa-introduccion** (task adicional, Tier 2). Host comprometido (blue team).

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
docker exec -it lab-incident-response-victim-1 sh
```

## Artefactos de compromiso (4 flags)

| Artefacto | Dónde mirar |
|---|---|
| Cron backdoor (root) | `cat /etc/crontabs/root` |
| Usuario oculto UID 0 | `grep :0: /etc/passwd` / `awk -F: '$3==0' /etc/passwd` |
| Proceso disfrazado | `ps aux` → binario en /tmp con nombre de kernel worker; config en `/var/tmp/.sys/conf` |
| Conexión C2 activa | `netstat -tn` → ESTABLISHED a c2-server:4444; conéctate tú: desde el host `nc 127.0.0.1:18108` |

## Contención sugerida
1. `crontab -r` (o editar) + borrar /tmp/.systemd-resolved
2. `userdel svc-helper` (UID 0 duplicado)
3. kill del proceso falso + borrar /tmp/.kworker y /var/tmp/.sys
4. aislar la máquina (aquí: `docker compose stop`) y rotar credenciales
