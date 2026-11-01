# Spec 008 — Deploy & Hardening (producción)

- **Estado:** en implementación
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

Cerrar la plataforma con un despliegue de producción reproducible y endurecido:
imágenes multi-stage, TLS automático con Caddy, secretos de compose, backups con
rotación, CI de imágenes y runbook operativo final.

## 2. Historias de usuario

- **US1 (P1)** — Como *operador*, despliego producción con dos comandos (build + up) y
  todo arranca: web con HTTPS, api, postgres, migraciones y admin bootstrap.
- **US2 (P1)** — Como *operador*, los secretos críticos (contraseña de BD, secret de
  auth) viajan como **secretos de compose** (archivos con permisos restringidos), no
  interpolados en el yaml.
- **US3 (P1)** — Como *operador*, hay backups automáticos con rotación y un script de
  restore probado.
- **US4 (P2)** — Como *operador*, CI valida que ambas imágenes Docker compilan en cada
  push a main.
- **US5 (P2)** — Como *usuario*, la web se sirve con HTTPS (Let's Encrypt con dominio, o
  certificado local interno sin dominio) y cabeceras de seguridad.

## 3. Requisitos funcionales

1. **Imágenes**: `apps/{api,web}/Dockerfile` multi-stage (prune → build → runner
   no-root) compilan y arrancan; el runner de la api carga migraciones opcionalmente
   (`MIGRATE_ON_BOOT=true` → `prisma migrate deploy`).
2. **Secretos**: `infra/stacks/prod/secrets/` con `postgres_password`,
   `better_auth_secret` (fuera de git, perms 600). API lee `BETTER_AUTH_SECRET` y la
   contraseña de BD desde `/run/secrets/*` si existen (entrypoint), postgres usa
   `POSTGRES_PASSWORD_FILE` nativo.
3. **Stack prod** (`infra/stacks/prod/compose.yaml`): web+api+postgres con healthchecks,
   `restart: unless-stopped`, `cap_drop: ALL` (postgres con sus caps mínimas), redes
   `prod_frontend` (caddy↔web) y `prod_backend` (web↔api↔postgres, sin exposición de
   puertos de api/postgres), postgres publicado opcional en 127.0.0.1:5433 para ops.
4. **Proxy** (`infra/stacks/proxy/`): Caddy con `Caddyfile` — modo dominio (ACME) o
   `tls internal` para localhost; cabeceras de seguridad (HSTS en modo dominio,
   X-Content-Type-Options, Referrer-Policy, frame deny); red externa compartida
   `cyberarena_proxy`.
5. **Backups**: `backup-db.sh` con rotación (`KEEP_DAYS`), `restore-db.sh`; runbook
   con cron de ejemplo.
6. **CI**: workflow `docker.yml` (push a main + manual) que construye ambas imágenes.
7. **Runbook final**: despliegue desde cero, actualización, migraciones, seed, backups,
   restore, checklist de seguridad (mapeado a ADR-006), troubleshooting.

## 4. Criterios de éxito (verificables)

- [ ] Ambas imágenes compilan (`docker build`) sin errores.
- [ ] E2E prod en localhost: `up` del proxy+prod → `curl -k https://localhost/es`
      sirve la landing; `/api/health` (vía rewrite) → `db: up`; login del admin
      bootstrap → 200; room player carga; `down -v` limpia.
- [ ] `docker inspect` muestra api/web con `CapDrop: ALL` y usuario no-root; los
      secretos no aparecen en `docker inspect` del compose ni en el yaml.
- [ ] Backup → contiene datos (rooms seedeados) → restore en una BD limpia →
      recuenta OK.
- [ ] `pnpm lint && typecheck && test && build` verdes; CI docker workflow presente.

## 5. Fuera de alcance

CD automático a un servidor, dominio real (se documenta el modo), monitoreo/alertas,
imágenes slim optimizadas (deuda documentada), staging environment.

## 6. Supuestos / deuda

- El runner copia el workspace podado completo (incluye devDeps) — imagen grande pero
  funcional; optimizar con `pnpm deploy --prod` queda como deuda T9xx.
- TLS local usa el CA interno de Caddy (`tls internal`): el navegador mostrará aviso
  salvo que se confíe en la CA local; con dominio real, ACME emite cert válido.
