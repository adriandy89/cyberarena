# Secrets de producción (compose secrets)

Crea estos archivos (NO se commitean — .gitignore cubre la carpeta; en Linux `chmod 600`,
en Windows NTFS los permisos POSIX no aplican — protégelo con ACLs del directorio):

```bash
cd infra/stacks/prod/secrets
# `tr -d '\r\n'`: el openssl de Git Bash (Windows) termina la salida en CRLF.
# Contraseña de postgres: SOLO alfanumérica (se incrusta en una URL de conexión).
openssl rand -hex 24 | tr -d '\r\n' > postgres_password
# Secret de better-auth (>=32 chars).
openssl rand -base64 32 | tr -d '\r\n=+/' > better_auth_secret
# Password del admin inicial (opcional: sin este archivo se genera una aleatoria
# y se registra UNA vez en el log del arranque — ADR-009).
printf 'TuPasswordInicial-12345' > bootstrap_admin_password
# Token compartido api <-> lab-runner (fase 011, ADR-015).
openssl rand -hex 32 | tr -d '\r\n' > lab_runner_token
chmod 600 postgres_password better_auth_secret bootstrap_admin_password lab_runner_token
```

Comprueba todo antes de desplegar: `bash infra/scripts/prod-preflight.sh`.

- `postgres_password` → POSTGRES_PASSWORD_FILE del contenedor postgres + DATABASE_URL
  de la api (el entrypoint lo lee de /run/secrets).
- `better_auth_secret` → BETTER_AUTH_SECRET de la api (entrypoint).
- `bootstrap_admin_password` → BOOTSTRAP_ADMIN_PASSWORD de la api (entrypoint); SOLO
  se usa si la tabla de usuarios está vacía al arrancar.
- `lab_runner_token` → LAB_RUNNER_TOKEN_FILE de la api y del lab-runner: sin él, el runner
  no arranca (32+ caracteres).

Los secretos de compose se montan como archivos en el contenedor: no aparecen en
`docker inspect` del servicio ni en el yaml.

**Sin `` (fase 012).** Créalos desde Git Bash con los comandos de arriba, no con el Bloc de notas
ni con `echo` de PowerShell: la imagen de Postgres lee `postgres_password` quitando el salto final
pero NO un ``, así que guardaría una contraseña distinta de la que usa la API. El entrypoint de la
API tolera `
`, Postgres no. `bash infra/scripts/prod-preflight.sh` lo comprueba (sin mostrar
los valores) y `tr -d '' < f > f.tmp && mv f.tmp f` lo corrige.
