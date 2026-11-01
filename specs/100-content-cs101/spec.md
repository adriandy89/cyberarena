# Spec 100 — Content Pack: Cyber Security 101 completo

- **Estado:** COMPLETADA (2026-11-01) — 14/14 módulos
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

Completar el path Cyber Security 101 con contenido ORIGINAL en español, siguiendo el
currículo de referencia (14 módulos) usando el pipeline ya construido
(`docs/content-guide.md`). Cada módulo es una tarea con su commit; la spec se cierra
cuando los 14 módulos están publicados y el path muestra horas/rooms coherentes.

## 2. Estructura de módulos (orden del path)

| # | Módulo | Rooms previstos | Estado |
|---|---|---|---|
| 1 | start-your-cyber-journey | 2 (intro, recon-web-basico+lab) | ✅ (fases 002/007) |
| 2 | linux-fundamentals | 3 (terminal, permisos/SUID, red/scripts) | ✅ 2026-11-01 |
| 3 | windows-ad-fundamentals | 2 (ediciones/registry/UAC, AD+Kerberos) | ✅ 2026-11-01 |
| 4 | command-line | 1 (cmd+PowerShell) — más rooms en iteración | ✅ 2026-11-01 (inicial) |
| 5 | networking | 1 (capas/DNS/HTTP) — más rooms en iteración | ✅ 2026-11-01 (inicial) |
| 6 | cryptography | 1 (simétrico/asimétrico, hashing, cracking+ROT13 flag) | ✅ 2026-11-01 |
| 7 | exploitation-basics | 1 (CVEs, Metasploit, shells) | ✅ 2026-11-01 |
| 8 | web-hacking | 1 (anatomía, validación cliente, Burp) | ✅ 2026-11-01 |
| 9 | offensive-tooling | 1 (hydra/gobuster/sqlmap) | ✅ 2026-11-01 |
| 10 | defensive-security | 1 (SOC/logs/incidentes) | ✅ 2026-11-01 |
| 11 | security-solutions | 1 (SIEM/firewall/IDS) | ✅ 2026-11-01 |
| 12 | defensive-tooling | 1 (CyberChef/REMnux/lab) | ✅ 2026-11-01 |
| 13 | cyber-career | 1 (principios/roles/siguiente paso) | ✅ 2026-11-01 |
| 14 | owasp-top-10 | 1 (Top 10 2025 completo) | ✅ 2026-11-01 |

(Recuentos ajustables al autor; mínimo 1 room de calidad por módulo.)

## 3. Reglas de autoría (del guide, resumen operativo)

- Contenido original en español; slugs/tags en inglés kebab-case; YAML con `": "` citado.
- Por room: intro ≥1 párrafo, 2-4 tasks con guía real, 4-8 preguntas (mezcla text/
  choice/flag), hints. Ids `<room>-tNN-qNN` estables. Flags autocontenidas (ejercicios
  decodificables con herramientas locales) o de lab cuando exista.
- Cada módulo termina en: build content OK → seed → catálogo verificado → commit.

## 4. Criterios de éxito

- [x] Cada módulo entregado: `pnpm --filter @repo/content build` verde + seed
      idempotente + `/api/catalog` muestra el path con las rooms nuevas + E2E de una
      pregunta nueva (respuesta correcta vía API). *(linux: 36 answers, catálogo 5
      rooms ≈3h, SUID y flag base64 resueltas vía API, página 200)*
- [x] Al cerrar la spec: los 14 módulos publicados, duración estimada coherente y
      `docs/content-guide.md` sin cambios necesarios. (14 módulos / 18 rooms / ~12h / 137 respuestas)

## 5. Fuera de alcance

Labs nuevos por módulo (se añaden en iteraciones 101+ siguiendo ADR/fase 007), EN
translations de contenido (ES primero por diseño).
