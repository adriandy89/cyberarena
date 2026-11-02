# Spec 104 — Labs Masivos: práctica real para todos los rooms

- **Estado:** COMPLETADA (2026-11-01) — 4 iteraciones, 22 labs
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

La brecha crítica: 30 de 34 rooms sin lab. Este spec añade **18 labs** que convierten
la plataforma de teórica a **entrenamiento práctico real** estilo TryHackMe.

## 2. Los 18 labs (4 tiers)

### TIER 1 (5 labs + 3 rooms nuevas) ✅
1. privesc-linux-1 (SUID, sudo, cron — Pattern C)
2. cmd-injection (ping utility → RCE — Pattern A)
3. file-upload (bypass validación — Pattern A)
4. nmap-playground (7 puertos con banners — Pattern B)
5. auth-bypass (basic auth, JWT, IDOR — Pattern A)

### TIER 2 (5 labs para rooms existentes)
6. linux-explore → linux-fundamentos-1/2
7. hash-cracking → criptografia-basica
8. hydra-target → herramientas-ofensivas
9. gobuster-target → web-hacking-basico
10. osint-target → recon-pasivo-osint

### TIER 3 (4 labs de profundización)
11-14: sqli-blind, xss-advanced, jwt-attack, ssrf-deep

### TIER 4 (4 extras)
15-18: log-forging, idor-chain, dns-enumerate, crypto-puzzle

## 3. Frontend
- Checkbox "Solo con labs" en hacktivities
- Badge 🧪 en path detail
- LabPanel con status check

## 4. Criterios
- Cada lab explotable + flags resoluble vía API
- Rooms nuevas en catálogo + hacktivities
- Filtro labs funciona
- Build verde + E2E
