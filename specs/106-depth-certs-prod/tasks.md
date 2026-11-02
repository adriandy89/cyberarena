# Spec 106 — tasks

## T1: Rooms teóricas (8)
- [x] pivoting-y-tunneling (jr-pt, módulo pivoting NUEVO, 3 tasks)
- [x] password-attacks (jr-pt, offensive-tooling, 3 tasks)
- [x] social-engineering (jr-pt, recon-pasivo, 2 tasks)
- [x] mobile-security (jr-pt, módulo mobile NUEVO, 2 tasks)
- [x] binary-exploitation (advanced, módulo binary-exploitation NUEVO, 3 tasks)
- [x] malware-analysis (cs101, defensive-tooling, 3 tasks)
- [x] threat-modeling (cs101, defensive-security, 2 tasks)
- [x] seguridad-wireless (cs101, networking, 2 tasks)
- [x] answers privadas + EN ×8 + wiring módulos/paths
- [x] build verde (59 rooms) + seed + E2E + commit

## T2: Certificados PDF
- [x] pdfkit + @types/pdfkit en apps/api
- [x] CertificateItem en @repo/shared (dedupe web)
- [x] certificate-pdf.service.ts (A4 landscape, ES/EN, código verificación)
- [x] GET /api/me/certificates/:slug/pdf (SessionGuard, attachment)
- [x] Web: botón Descargar PDF (fetch blob) + mensajes ES/EN
- [x] Unit test del builder (%PDF magic, contenido)
- [x] Verificación manual vs dev stack (solves del path más corto) + commit

## T3: Stack prod verificado
- [x] Fix comentario stale compose prod
- [x] Puertos 80/443 libres; proxy up; prod up --build (fase 012 T009)
- [x] Seed one-off; smoke tests (TLS, health, admin login, catálogo 59, PDF, hacktivities) (fase 012 T009)
- [x] backup-db.sh + restore a BD scratch (fase 012 T011)
- [x] Registro aquí + runbook ajustado si diverge + commit (fase 012 T012)

## T4: Limpieza final
- [ ] down -v proxy+prod; borrar :local images; docker builder/image prune
- [ ] pnpm store prune; borrar .turbo y apps/web/.next
- [ ] docker df antes/después reportado

## Registro

- 2026-11-02 (sesión de la fase 010/107): T1 y T2 verificados y marcados. T1 ya estaba en
  `f3d756e`; desde la fase 010 `password-attacks` vive en JrPT (módulo `passwords`) y
  `mobile-security` al final de WebApp. T2: E2E contra el dev stack con el script one-off
  (usuario con las 58 preguntas de Advanced resueltas) → `/api/me/certificates` lista el path,
  PDF ES y EN `200 application/pdf` con cabecera `%PDF-`, path no completado → 404. Después se
  borraron el script `packages/database/scripts-tmp-cert-e2e.ts`, el `cert-preview-es.pdf` de la
  raíz y los 7 usuarios `cert-test-*` que había creado. Corregido el comentario del compose prod
  (`--project-directory infra/stacks/prod`, como el runbook).
- 2026-11-02 (fase 012): **T3 completada.** Stack prod + proxy + lab-runner desplegado y verificado:
  seed doble, smoke (TLS, health, admin, catálogo 59 ES/EN, PDF, hacktivities, 118 páginas de rooms),
  E2E sobre HTTPS, labs bajo demanda (39/39 y flags reales) y backup + restore a BD scratch con conteos
  idénticos. El runbook divergía (seed con un montaje que el código no leía, restore con valores por
  defecto de dev, `docker cp` sin destino…): reescrito con los comandos verificados. Detalle en el
  registro de `specs/012-despliegue-docker/tasks.md`.
