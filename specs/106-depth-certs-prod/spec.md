# Spec 106 — Profundidad de contenido, certificados PDF y prod verificado

- **Estado:** en curso — T1 y T2 completadas (2026-11-02); T3 y T4 se ejecutan dentro de la fase 012.
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión.
  - 2026-11-02 T1 y T2 verificadas (ver «Registro» en `tasks.md`). T3 (stack prod verificado) y T4
    (limpieza) pasan a la fase `012-despliegue-docker`, que despliega también el lab-runner de la 011; sus
    casillas se marcan aquí con referencia al registro de la 012.
  - 2026-11-02 alcance de la limpieza acotado por decisión del usuario: solo recursos de este proyecto e
    imágenes huérfanas; nada de prunes globales que afecten a otros proyectos.

## Contexto

El catálogo tiene 51 rooms con fuerte sesgo práctico (35 con lab), pero la
auditoría de huecos temáticos detectó dominios enteros sin cobertura
(pivoting, password attacks teórico, social engineering, binary
exploitation, malware analysis, threat modeling, mobile, wireless). El
certificado de path existe solo como página imprimible (`window.print()`);
la generación server-side se pospuso en spec 005. El stack prod nunca se
levantó completo (imágenes construidas, sin contenedores).

## Objetivos

1. **Ocho rooms teóricas nuevas** cubriendo los huecos, con comandos
   oficiales reales en ES y EN (sin labs nuevos).
2. **Certificado PDF descargable** generado server-side (pdfkit, sin deps
   nativas) con código de verificación determinista.
3. **Stack prod desplegado y probado end-to-end en localhost** (Caddy TLS
   interno, admin bootstrap, seed, backup/restore a BD scratch), luego
   `down -v`.

## Alcance

- Rooms (8): pivoting-y-tunneling, password-attacks, social-engineering,
  mobile-security (jr-pentester); binary-exploitation (advanced);
  malware-analysis, threat-modeling, seguridad-wireless (CS101).
  Módulos nuevos: `pivoting`, `mobile`, `binary-exploitation`.
- Certificados: `GET /api/me/certificates/:slug/pdf` (pdfkit, A4
  horizontal, ES/EN por ?locale=), botón "Descargar PDF" en la web,
  `CertificateItem` promovido a @repo/shared, código de verificación
  `sha256(userId|pathSlug|completedAt).slice(0,16)`.
- Prod: fix del comentario stale del compose, procedimiento del runbook,
  smoke tests, backup + restore no destructivo.

## Fuera de alcance

- Persistencia de Certificate en BD (sigue computado on-the-fly).
- Registro de imágenes Docker / despliegue en dominio real con ACME.
- Labs Docker nuevos para estas rooms (la teoría referencia herramientas
  reales que el estudiante puede instalar).

## Criterios de aceptación

- Build contenido verde: 59 rooms; seed OK; E2E 11/11.
- PDF: unit test del builder verde; descarga end-to-end verificada contra
  el dev stack (usuario con QuestionSolved insertadas del path más corto).
- Prod: TLS + API + admin login + catálogo 59 rooms ES/EN + PDF endpoint
  vivo + backup y restore-a-scratch verificados; `down -v` final.
- Limpieza: docker builder/image prune, pnpm store prune, .turbo/.next
  borrados, imágenes :local unreferenciadas eliminadas.
