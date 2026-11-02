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

## ✅ TIER 2 — completo (2026-11-02)

| # | Lab | Puerto | Room | Flags | Verificación |
|---|---|---|---|---|---|
| 6 | `pcap-analysis` | 18104 | redes-wireshark (task 3) | 3 | pcaps hand-crafted; Basic auth decodificado, FTP PASS en claro, base32 DNS decodifica exacto |
| 7 | `steganography-lab` | 18105 | steganography (NUEVA) | 3 | LSB roundtrip assert en generador; JPEG COM y zip-tras-IEND extraídos |
| 8 | `phishing-analysis` | 18106 | phishing-forensics (NUEVA) | 4 | /verify valida origen/URL/attachment; SPF +all |
| 9 | `siem-correlation` | 18107 | seguridad-soluciones (task 3) | 3 | kill chain recon→brute→exploit→cron→C2 en 3 fuentes |
| 10 | `incident-response` | exec | defensa-introduccion (task 4) | 4 | cron backdoor, UID-0 user, fake kworker, conexión C2 ESTABLISHED + token desde host |

## ✅ TIER 3 — completo (2026-11-02)

| # | Lab | Puerto | Room | Flags | Verificación |
|---|---|---|---|---|---|
| 11 | `graphql-injection` | 18109 | graphql-security (NUEVA) | 3 | introspection→SecretFlag, IDOR user(id:1), filter injection |
| 12 | `websocket-lab` | 18110 | websocket-security (NUEVA) | 2 | RFC 6455 real (accept válido); sender spoof + /admin dump |
| 13 | `reverse-engineering` | 18111 | reverse-engineering (NUEVA) | 3 | strings/b64, zlib, XOR 0x5A sobre ELF construido |
| 14 | `dns-exfiltration` | 18112+18153/udp | data-exfiltration (NUEVA) | 2 | receptor DNS UDP real; reassembly exacto del secret; /detect |
| 15 | `container-escape-lab` | exec | containers-y-cloud (task 3) | 3 | fake dockerd sobre unix socket: /version, create privileged+bind, start, logs |
| 16 | `firewall-bypass` | 18180/18443/18844 | web-red-team (task 3) | 2 | túnel por 443; source-port 53 desde dentro (NAT reescribe el origen) |
| 17 | `cloud-iam-sim` | 18115 | containers-y-cloud (task 4) | 3 | IMDS creds, bucket público (tfstate), IAM wildcard |
| 18 | `ad-forest-lab` | 18116 | ad-avanzado (task 3) | 4 | kerberoast, LDAP injection, ESC1 cert SAN admin, trust externo |

Catálogo final: **51 rooms, 402 answers, 52 EN translations, 141 tasks**.
Labs totales en `labs/`: **34** (30 con puerto HTTP/exec + template).
E2E 11/11 contra `next start`.

### Notas técnicas Tier 2/3
- Los pcaps se generan paquete a paquete (Ethernet/IPv4/TCP/UDP válidos,
  checksums IP correctos) — Wireshark los disecta completo.
- El BMP LSB embebe sobre el layout final (filas bottom-up del formato).
- El websocket server implementa handshake + frames masked desde cero
  (stdlib, sin librería websockets).
- container-escape: el daemon del socket es SIMULADO (fake-dockerd) para
  practicar curl --unix-socket sin riesgo real al host.
- firewall-bypass source-port: docker-proxy NAT reescribe el puerto
  origen desde fuera → la técnica se práctica con docker exec (pivot).

## Estado: 18/18 labs implementados ✅

## Sweep final (2026-11-02, mismo día)

Auditoría labs↔rooms: ningún room referencia labs inexistentes, pero 5
labs no estaban cableados en frontmatter. Resultado del sweep:
- 4 ya tenían tasks teóricas (spec 104) — añadidas preguntas de flag:
  sqli-blind (oráculo booleano verificado F=✅/Z=❌; /status oráculo sobre
  config.api_key), xss-advanced (DOM/bypass/CSP), ssrf-deep y
  crypto-puzzle ya tenían flags.
- dns-enumerate: task 4 NUEVA en recon-activo-escaneo + wiring del lab.
- Catálogo final del sweep: 51 rooms / 410 answers / 142 tasks.
- Verificación local completa: build 5/5, lint 9/9, typecheck 10/10,
  test 6/6, E2E 11/11. ROADMAP actualizado con F13/F14.
