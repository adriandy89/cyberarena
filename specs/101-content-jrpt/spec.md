# Spec 101 — Content Pack: Jr Penetration Tester

- **Estado:** COMPLETADA (2026-11-01) — 7/8 módulos (web-owasp cubierto por CS101 owasp + burp; labs dedicados en iteración 102)
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

El segundo path de la plataforma: de los fundamentos (CS101) al pentesting junior
práctico. Metodología, herramientas a fondo y laboratorios.

## 2. Módulos previstos (orden del path `jr-penetration-tester`)

| # | Módulo | Rooms previstos | Estado |
|---|---|---|---|
| 1 | pentest-foundations | 1 (metodología, kill chain, reporte) | 🚧 esta sesión |
| 2 | recon-pasivo | 1 (crt.sh, dorks, metadata) | ✅ |
| 3 | recon-activo | 1 (host/port/version discovery) | ✅ |
| 4 | nmap | 1 (scan types, evasión, NSE, output) | ✅ |
| 6 | burp-suite | 1 (proxy/repeater/intruder) | ✅ |
| 7 | web-owasp | ver CS101 módulo owasp + burp (labs: iteración 102) | ⬜ |
| 8 | privesc | 2 (linux SUID/cron/PATH + windows servicios/tokens) | ✅ |
| 9 | active-directory | 1 (BloodHound, Kerberoast, PtH) | ✅ |
| 10 | scripting | 1 (bash scanner, python fuzzer, pipelines) | ✅ |

(Recuentos ajustables; mínimo 1 room sólido por módulo.)

## 3. Reglas

Idénticas a spec 100 (guía de contenido + ciclo por módulo: build → seed → E2E →
commit). Los labs Docker nuevos se marcan en la room con `lab:` + `labUrl:` y se
crean bajo `labs/<slug>/` siguiendo ADR-006/007.

## 4. Criterios de éxito

- [ ] Cada módulo entregado sigue el ciclo verificado de la spec 100.
- [ ] Al cerrar: path completo navegable con progreso y XP coherentes.
