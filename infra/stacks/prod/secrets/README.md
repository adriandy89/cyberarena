# Secrets de producción (compose secrets)

Crea estos archivos (NO se commitean — .gitignore cubre la carpeta; en Linux `chmod 600`,
en Windows NTFS los permisos POSIX no aplican — protégelo con ACLs del directorio):

```bash
cd infra/stacks/prod/secrets
# Contraseña de postgres: SOLO alfanumérica (se incrusta en una URL de conexión).
openssl rand -hex 24 > postgres_password
# Secret de better-auth (>=32 chars).
openssl rand -base64 32 | tr -d '\n=+/' > better_auth_secret
# Password del admin inicial (opcional: sin este archivo se genera una aleatoria
# y se registra UNA vez en el log del arranque — ADR-009).
printf 'TuPasswordInicial-12345' > bootstrap_admin_password
chmod 600 postgres_password better_auth_secret bootstrap_admin_password
```

- `postgres_password` → POSTGRES_PASSWORD_FILE del contenedor postgres + DATABASE_URL
  de la api (el entrypoint lo lee de /run/secrets).
- `better_auth_secret` → BETTER_AUTH_SECRET de la api (entrypoint).
- `bootstrap_admin_password` → BOOTSTRAP_ADMIN_PASSWORD de la api (entrypoint); SOLO
  se usa si la tabla de usuarios está vacía al arrancar.

Los secretos de compose se montan como archivos en el contenedor: no aparecen en
`docker inspect` del servicio ni en el yaml.
