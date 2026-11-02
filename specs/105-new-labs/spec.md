# Spec 105 — Nuevos labs priorizados por impacto de aprendizaje

- **Estado:** completada (2026-11-02)
- **Creada:** 2026-11-02 (como `proposal.md`)
- **Changelog:**
  - 2026-11-02 primera versión (propuesta de 18 labs en 3 tiers).
  - 2026-11-02 completada; el registro de ejecución está en `tasks.md`.
  - 2026-11-02 renombrada `proposal.md` → `spec.md` (constitución §3.1). El texto de abajo es la propuesta
    original: la cabecera «Estado actual» describe el punto de partida, no el resultado.

> Estado actual: 21 labs / 17 rooms con lab / 325 preguntas
> Patrón: Python stdlib (A: web app, B: multi-puerto, C: Linux exec, D: OSINT estático, E: challenge)
> Todos con: red aislada, 127.0.0.1 only, cap_drop ALL, flags por env, cero builds

---

## 🔴 TIER 1 — ALTO IMPACTO (temas que TODO pentester necesita practicar)

### 1. `race-condition`
**Room:** nueva `race-condition` (WebApp Pentesting) · **Patrón:** A · **Flags:** 3
**Qué enseña:** TOCTOU (Time-of-Check-Time-of-Use), double-spend, limit bypass.
**App:** Sistema de puntos/cupones con race condition en el endpoint de canje.
El estudiante envía 20 peticiones paralelas y observa que puede canjear el mismo
cupón múltiples veces. La versión "parcheada" (con lock) está en otro endpoint.
```
POST /redeem?code=WELCOME10  → sin lock (vulnerable)
POST /redeem-safe?code=...   → con lock (comparación)
```
**Flags:** 1 por canje múltiple exitoso, 1 por bypass del límite diario, 1 por balance negativo.

### 2. `cookie-session-lab`
**Room:** nueva `session-security` (WebApp Pentesting) · **Patrón:** A · **Flags:** 4
**Qué enseña:** Session prediction, cookie flags (HttpOnly/Secure/SameSite),
session fixation, JWT replay.
**App:** Login con sesiones predecibles (sequential IDs), cookies sin flags,
y JWT sin expiración. El estudiante debe:
- Predecir session IDs de otros usuarios
- Robar cookie via XSS (sin HttpOnly)
- Reemplazar su sesión por la de admin
- Re-play un JWT expirado (sin validación de exp)
**Flags:** 1 por técnica exitosa.

### 3. `api-bola-bfla`
**Room:** nueva `api-security` (WebApp Pentesting) · **Patrón:** A · **Flags:** 4
**Qué enseña:** OWASP API Security Top 10: BOLA (Broken Object Level Authorization),
BFLA (Broken Function Level Authorization), unrestricted resource consumption, mass assignment.
**App:** API REST con endpoints que no verifican ownership:
```
GET /api/orders/{id}     → BOLA: cualquier user puede ver cualquier order
DELETE /api/users/{id}   → BFLA: solo admin debería poder, pero cualquier user puede
POST /api/orders         → Mass assignment: enviar {"role":"admin"} en el body
GET /api/export          → Sin rate limit: descargar toda la BD
```
**Flags:** 1 por vulnerabilidad explotada.

### 4. `log-injection`
**Room:** nueva `log-forging` (WebApp Pentesting) · **Patrón:** A · **Flags:** 3
**Qué enseña:** CRLF injection, log forging, XSS via logs (admin ve logs en browser).
**App:** Formulario de "feedback" que escribe a logs. El estudiante inyecta:
- `\r\n` para forjar entradas de log falsas
- `<script>` en el log (XSS al admin que lee logs en browser)
- SQL injection en el log (para log poisoning + LFI)
**Flags:** 1 por técnica.

### 5. `c2-simulation`
**Room:** nueva `detection-evasion` (Advanced Pentesting) · **Patrón:** A+B · **Flags:** 3
**Qué enseña:** C2 beacons, jitter, domain fronting, DNS tunneling.
**App:** Servidor C2 que simula beacons HTTP con/sin jitter, DNS queries con datos
exfiltrados. El estudiante (como defensor) debe identificar patrones maliciosos
en logs. Como atacante, debe exfiltrar datos sin disparar alertas.
**Flags:** 1 por bypass de detección, 1 por exfiltración exitosa, 1 por identificación como defensor.

---

## 🟡 TIER 2 — MEDIO IMPACTO (especialización práctica)

### 6. `pcap-analysis`
**Room:** redes-wireshark (task adicional) · **Patrón:** D (static files) · **Flags:** 3
**Qué enseña:** Análisis de capturas de red reales: extraer credenciales, reconstruir
sesiones, identificar malware C2 en tráfico.
**App:** Servir archivos .pcap pre-generados que el estudiante descarga y abre en Wireshark.
**Flags ocultas en:** 1 en HTTP Basic Auth header, 1 en FTP session, 1 en DNS query.
**Generación:** Usar `tcpdump` o scapy para generar pcaps con credenciales.

### 7. `steganography-lab`
**Room:** nueva `steganography` (WebApp Pentesting / CS101) · **Patrón:** A+D · **Flags:** 3
**Qué enseña:** Ocultar/extraer datos en imágenes: LSB steganography, metadata EXIF,
strings en binarios, archivos embebidos.
**App:** Servir imágenes con datos ocultos (usando PIL para LSB, exiftool para metadata).
**Flags:** 1 en LSB de un PNG, 1 en EXIF de un JPEG, 1 en strings de un binario.

### 8. `phishing-analysis`
**Room:** nueva `phishing-forensics` (defensive) · **Patrón:** A · **Flags:** 4
**Qué enseña:** Análisis de emails de phishing: headers, URLs maliciosas, attachments,
SPF/DKIM/DMARC, indicios de spoofing.
**App:** Servir emails en formato .eml con headers maliciosos, URLs de phishing,
attachments con malware simulado.
**Flags:** 1 por identificar el servidor real de origen, 1 por la URL de phishing,
1 por el attachment malicioso, 1 por el SPF bypass.

### 9. `siem-correlation`
**Room:** seguridad-soluciones (task adicional) · **Patrón:** A · **Flags:** 3
**Qué enseña:** Correlación de eventos de múltiples fuentes para detectar un ataque en
progreso.
**App:** Servir logs de 3 fuentes (firewall, auth, web) con un ataque en cadena:
recon → exploit → persistence → exfiltration. El estudiante correlaciona eventos
por IP/usuario/timestamp para reconstruir el kill chain.
**Flags:** 1 por identificar la IP atacante, 1 por el timestamp del exploit,
1 por la técnica de persistencia.

### 10. `incident-response`
**Room:** defensa-introduccion (task adicional) · **Patrón:** C (Linux exec) · **Flags:** 4
**Qué enseña:** Investigar un sistema comprometido: procesos sospechosos, crontabs,
usuarios no autorizados, conexiones de red, persistence mechanisms.
**App:** Contenedor Linux con artefactos de compromiso: backdoor en cron, usuario
oculto, proceso con nombre falso, SSH key no autorizada, conexión C2 activa.
**Flags:** 1 por encontrar cada artefacto (cron, user, proceso, C2).

---

## 🟢 TIER 3 — NICE TO HAVE (ambicioso / especialización)

### 11. `graphql-injection`
**Room:** nueva `graphql-security` (WebApp) · **Patrón:** A · **Flags:** 3
**Qué enseña:** GraphQL introspection, IDOR via queries, injection en resolvers.
**App:** API GraphQL con introspection habilitada, IDs sin autorización.
**Nota:** Requiere librería GraphQL → No es puro stdlib. Usarariamos `graphene` o Ariadne.
**Alternativa stdlib:** Simular GraphQL responses sin parser real.

### 12. `websocket-lab`
**Room:** nueva `websocket-security` (WebApp) · **Patrón:** A · **Flags:** 2
**Qué enseña:** WebSocket authentication bypass, message injection, CSWSH.
**App:** Chat WebSocket donde puedes inyectar mensajes de otros usuarios.
**Nota:** `websockets` lib está en stdlib (no en http.server pero sí en asyncio).

### 13. `reverse-engineering`
**Room:** nueva `reverse-engineering` (CS101/advanced) · **Patrón:** E · **Flags:** 3
**Qué enseña:** Análisis de binarios: strings, ltrace/strace, objdump, gdb básico.
**App:** Servir binarios ELF con flags embebidas (strings, en código ofuscado,
requiriendo debugger).
**Flags:** 1 en strings, 1 en ltrace, 1 en gdb breakpoint.

### 14. `dns-exfiltration`
**Room:** nueva `data-exfiltration` (Advanced) · **Patrón:** A+B · **Flags:** 2
**Qué enseña:** Exfiltrar datos vía DNS queries (subdomain encoding).
**App:** DNS-like server que loggea queries. El estudiante codifica datos en
subdomains y los decodifica del otro lado.
**Flags:** 1 por exfiltrar exitosamente, 1 por detectar la exfiltración.

### 15. `container-escape-lab`
**Room:** containers-y-cloud (task adicional) · **Patrón:** C · **Flags:** 3
**Qué enseña:** Escapar de un contenedor Docker con misconfiguraciones.
**App:** Contenedor Alpine con: docker.sock montado, --privileged, capabilities
excesivas. El estudiante encuentra y explota cada vector.
**Flags:** 1 via docker.sock, 1 via privileged, 1 via CAP_SYS_MODULE.

### 16. `firewall-bypass`
**Room:** web-red-team (task adicional) · **Patrón:** B · **Flags:** 2
**Qué enseña:** Bypass de reglas de firewall mediante IP fragmentation, source
port manipulation, protocol tunneling.
**App:** Multi-puerto server que simula reglas de firewall (bloquea puerto 80
pero permite 443, bloquea ciertos IPs, permite source port 53).

### 17. `cloud-iam-sim`
**Room:** containers-y-cloud (task adicional) · **Patrón:** A · **Flags:** 3
**Qué enseña:** IAM misconfigurations en AWS: S3 público, IAM role sobre-permisionado,
metadata endpoint, credentials en environment.
**App:** API que simula AWS (STS, S3, IAM) con las mismas misconfiguraciones comunes.

### 18. `ad-forest-lab`
**Room:** ad-avanzado (task adicional) · **Patrón:** A · **Flags:** 4
**Qué enseña:** Kerberos delegation, ADCS abuse, trust relationships.
**App:** Simulación de AD con LDAP-like interface, Kerberos ticket flow,
certificate authority simulada.
**Nota:** Complejo. Usar Samba/OpenLDAP en Docker sería más real pero más pesado.

---

## 📊 RESUMEN

| Tier | Labs | Flags nuevas | Rooms nuevas | Esfuerzo |
|------|------|-------------|--------------|----------|
| T1 | 5 | 17 | 4-5 | Medio (2-3h c/u) |
| T2 | 5 | 17 | 3-4 | Medio (2h c/u) |
| T3 | 8 | 22 | 4-5 | Alto (3-4h c/u) |
| **Total** | **18** | **56** | **11-14** | — |

## 🏗️ FACTIBILIDAD TÉCNICA

| Patrón | Labs | Factible con stdlib | Notas |
|--------|------|-------------------|-------|
| A: Web app | 13 | ✅ 11 | GraphQL necesita lib, WebSocket puede usar asyncio |
| B: Multi-puerto | 2 | ✅ 2 | Puro stdlib |
| C: Linux exec | 2 | ✅ 2 | Contenedor Alpine con setup.sh |
| D: Static | 2 | ✅ 1 | pcap necesita generación offline |
| E: Challenge | 1 | ✅ 1 | Servir binarios |

## 🥇 MI RECOMENDACIÓN: EMPEZAR POR

1. **race-condition** — el concepto que más separa juniors de seniors
2. **cookie-session-lab** — fundamental para entender auth web
3. **api-bola-bfla** — API security es el presente
4. **log-injection** — CVE-2021-44228 empezó así
5. **pcap-analysis** — skill daily del SOC analyst
