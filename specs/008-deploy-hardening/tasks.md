# Tasks 008 — Deploy & Hardening

- [x] T001 [P] specs/008.
- [x] T002 [US2] Secrets compose (postgres password file, better-auth, bootstrap admin)
      + entrypoint de la api (carga /run/secrets, DATABASE_URL por partes,
      MIGRATE_ON_BOOT).
- [x] T003 [US1,US5] Stack prod (redes segregadas con backend internal, cap_drop,
      healthchecks, restart) + proxy Caddy (tls internal/ACME, cabeceras, /api→api).
- [x] T004 [US1] Imágenes api y web construidas y corregidas (standalone en
      apps/web + static copiado; HOSTNAME=0.0.0.0).
- [x] T003b [US5] Caddy enruta /api/* directamente (rewrites de Next son build-time).
- [x] T005 [US3] backup-db.sh con rotación + restore-db.sh con confirmación.
- [x] T006 [US4] CI docker.yml (build de ambas imágenes en push a main).
- [x] T007 [US1] E2E prod completo: proxy+prod up, 7 migraciones automáticas,
      bootstrap admin, seed one-off (red interna), https landing/health/login/
      catálogo/room, backup 14 tablas → restore intacto, teardown limpio.
- [x] T008 [US1..US5] Runbook final (despliegue, seed, actualizar, TLS, backups,
      checklist ADR-006, troubleshooting) + secrets README + cierre.

## Bugs/Deuda

- T901 Optimizar tamaño de imagen (runner copia devDeps; usar pnpm deploy --prod).
- T902 Publicación loopback-only de 5433 inconsistente en Docker Desktop/Windows:
      ops vía docker exec; revisar al desplegar en Linux.
