# Lab linux-explore

Rooms: **linux-fundamentos-1** y **linux-fundamentos-2** (CS101).

## Despliegue
```bash
cp flags.env.example flags.env
docker compose -f labs/linux-explore/compose.yaml --env-file labs/linux-explore/flags.env up -d
docker exec -it lab-linux-explore-shell-1 su - explorer
```

## Flags
| # | Escondida en | Comando para encontrarla |
|---|---|---|
| 1 | `.secret_flag` (dotfile) | `ls -la ~` → `cat .secret_flag` |
| 2 | Comentario en `/etc/passwd` | `grep FLAG /etc/passwd` |
| 3 | Log de aplicación | `grep -r "secret" /var/log/` |
| 4 | Archivo con permisos de grupo | `find / -name "*flag*" -not -path "/proc/*" 2>/dev/null` → `cat /opt/group_only_flag.txt` (eres del grupo flagreaders) |
