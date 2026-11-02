# Spec 106 — tasks

## T1: Rooms teóricas (8)
- [ ] pivoting-y-tunneling (jr-pt, módulo pivoting NUEVO, 3 tasks)
- [ ] password-attacks (jr-pt, offensive-tooling, 3 tasks)
- [ ] social-engineering (jr-pt, recon-pasivo, 2 tasks)
- [ ] mobile-security (jr-pt, módulo mobile NUEVO, 2 tasks)
- [ ] binary-exploitation (advanced, módulo binary-exploitation NUEVO, 3 tasks)
- [ ] malware-analysis (cs101, defensive-tooling, 3 tasks)
- [ ] threat-modeling (cs101, defensive-security, 2 tasks)
- [ ] seguridad-wireless (cs101, networking, 2 tasks)
- [ ] answers privadas + EN ×8 + wiring módulos/paths
- [ ] build verde (59 rooms) + seed + E2E + commit

## T2: Certificados PDF
- [ ] pdfkit + @types/pdfkit en apps/api
- [ ] CertificateItem en @repo/shared (dedupe web)
- [ ] certificate-pdf.service.ts (A4 landscape, ES/EN, código verificación)
- [ ] GET /api/me/certificates/:slug/pdf (SessionGuard, attachment)
- [ ] Web: botón Descargar PDF (fetch blob) + mensajes ES/EN
- [ ] Unit test del builder (%PDF magic, contenido)
- [ ] Verificación manual vs dev stack (solves del path más corto) + commit

## T3: Stack prod verificado
- [ ] Fix comentario stale compose prod
- [ ] Puertos 80/443 libres; proxy up; prod up --build
- [ ] Seed one-off; smoke tests (TLS, health, admin login, catálogo 59, PDF, hacktivities)
- [ ] backup-db.sh + restore a BD scratch
- [ ] Registro aquí + runbook ajustado si diverge + commit

## T4: Limpieza final
- [ ] down -v proxy+prod; borrar :local images; docker builder/image prune
- [ ] pnpm store prune; borrar .turbo y apps/web/.next
- [ ] docker df antes/después reportado
