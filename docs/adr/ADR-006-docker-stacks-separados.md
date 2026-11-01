# ADR-006 — Docker: stacks separados por carpetas + hardening desde el día 0

- **Estado:** aceptada (2026-11-01, fase 000 — requisito explícito del usuario)
- **Contexto:** todo el despliegue y ambiente deben ser Docker con compose, seguros, y con
  stacks separados por carpetas del repositorio.
- **Decisión:**
  - `infra/stacks/dev/` — postgres 18-alpine + mailpit + api + web con volúmenes y
    hot-reload; perfil `--profile infra` para solo base de datos; redes `dev_backend`
    (api↔db, cerrada) y `dev_frontend` (web↔api).
  - `infra/stacks/prod/` (F8) y `infra/stacks/proxy/` (F8) — imágenes multi-stage con
    `turbo prune --docker`, Caddy con HTTPS ACME.
  - `labs/<room>/` — stacks independientes por room con red interna aislada y sin acceso a
    las redes de la app (patrón Vulhub).
  - Hardening por defecto: contenedores no-root, `cap_drop: ALL`, healthchecks en todos los
    servicios, imágenes con tag fijo, `.env` por stack no commiteado (con `.env.example`).
- **Consecuencias:** un comando por entorno; blast-radius acotado por red; el hot-reload en
  Windows con volúmenes puede requerir polling (mitigado y documentado en runbook con la
  variante mixed dev). Los labs quedan imposibilitados de alcanzar la BD aunque se
  comprometa un contenedor vulnerable.
