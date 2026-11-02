# Spec 105 — Nuevos labs: registro de ejecución

Fuente: `proposal.md` (18 labs en 3 tiers). Estado por iteración.

## ✅ TIER 1 — completo (2026-11-02)

| # | Lab | Puerto | Room nueva | Flags | Verificación |
|---|---|---|---|---|---|
| 1 | `race-condition` | 127.0.0.1:18099 | `race-condition` (módulo `api-logic`) | 3 | secuencial=0 flags, paralelo=3 flags (curl) |
| 2 | `cookie-session-lab` | 127.0.0.1:18100 | `session-security` (módulo `auth`) | 4 | flujo completo curl (predicción, steal, replay) |
| 3 | `api-bola-bfla` | 127.0.0.1:18101 | `api-security` (módulo `api-logic`) | 4 | BOLA/BFLA/mass-assignment/export curl |
| 4 | `log-injection` | 127.0.0.1:18102 | `log-forging` (módulo `injection-misc`) | 3 | CRLF/XSS/poisoning curl |
| 5 | `c2-simulation` | 127.0.0.1:18103 | `detection-evasion` (módulo `web-red-team`) | 3 | 3 beacons → /detect dispara FIXED_INTERVAL + DNS exfil |

Contenido: 5 rooms (index + 2 tasks c/u), 31 preguntas, answers privadas,
traducciones EN, módulo nuevo `api-logic` en path `webapp-pentesting`.
Build contenido: 45 rooms / 356 answers / 46 EN. Seed OK. E2E 11/11.

### Bugs encontrados y corregidos durante Tier 1

1. **Auth roto en runtime** (crítico): el plugin `twoFactor` de Better Auth
   estaba activo pero el schema Prisma no tenía las tablas → TODO sign-up /
   sign-in devolvía 500 (`SchemaMismatchError`). Migraciones
   `20261102000004_two_factor_plugin` + `_two_factor_plugin_fields`
   (modelo `TwoFactor` con secret/backupCodes/verified/failedVerificationCount/
   lockedUntil + `User.twoFactorEnabled`). Enmascarado antes porque los tests
   de auth se saltan en CI.
2. **Catálogo EN nunca servido**: `CONTENT_DIST` resolvía a `../../content/dist`
   que no existe ni en dev ni en prod (real: `packages/content/dist`); el
   fallback silencioso a ES enmascaraba el bug. Ahora multi-candidato con
   existsSync. `?locale=en` verificado funcionando.
3. **Logout redirigía a /es/es** (404): `router.replace(`/${locale}`)` con el
   router de next-intl que ya prefija. Corregido a `router.replace('/')` en
   `user-menu.tsx` (cubierto por E2E auth flow).
4. **race-condition no tenía carrera real**: `HTTPServer` single-threaded
   serializaba los requests. Cambiado a `ThreadingHTTPServer` + `/buy`
   rediseñado (barrera max+10 inalcanzable secuencialmente) + `/checkout`
   nuevo (balance TOCTOU: secuencial nunca negativo, paralelo -50) + `/reset`.
5. **cookie-session-lab**: FLAG_2 inalcanzable (ningún endpoint la daba) →
   añadido `/steal?c=` (colector del atacante). Login con contador real de
   session IDs secuenciales (100, 101, ...).
6. **api-bola-bfla**: orden de rutas rompía POST `/api/orders/create`
   (caía en el prefijo `/api/orders/` → ValueError). Exact matches primero.
7. **E2E stale asserts**: linux-fundamentos-1 creció a 4 tareas/12 preguntas;
   spec actualizado. E2E debe correr contra `next start` (build), no contra
   el `next dev` del container (locks de .next compartidos por bind mount).

## ⏳ TIER 2 — pendiente

pcap-analysis, steganography-lab, phishing-analysis, siem-correlation,
incident-response (5 labs, rooms de blue team).

## ⏳ TIER 3 — pendiente

graphql-injection, websocket-lab, reverse-engineering, dns-exfiltration,
container-escape-lab, firewall-bypass, cloud-iam-sim, ad-forest-lab (8 labs).
