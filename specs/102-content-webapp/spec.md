# Spec 102 — Content Pack: Web Application Pentesting

- **Estado:** COMPLETADA (2026-11-01) — 3 módulos con labs reales
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

El tercer path: especialización web ofensiva con **labs Docker reales vulnerables**.
Cada room de explotación tiene su lab donde el estudiante PRACTICA el ataque de verdad.

## 2. Módulos

| # | Módulo | Rooms | Lab | Estado |
|---|---|---|---|---|
| 1 | sqli | sqli-basico (lab SQLi real) | ✅ | 🚧 |
| 2 | xss | xss-reflejado (lab XSS real) | ✅ | 🚧 |
| 3 | ssrf | ssrf-basico (lab SSRF real) | ✅ | 🚧 |
| 4 | injection-misc | command-injection + file-upload | — | 🚧 |

## 3. Arquitectura de labs

Labs declarativos con `python:3.12-alpine` + **solo stdlib** (http.server, sqlite3,
urllib): cero builds de imágenes, cero pip install. El script vulnerable se monta
read-only desde `site/` y las flags se inyectan por env (patrón ADR-006/007).

## 4. Criterios de éxito

- [ ] Cada lab levanta, es explotable de verdad y su flag se resuelve vía API.
- [ ] `pnpm build` verde, seed, catálogo actualizado.
