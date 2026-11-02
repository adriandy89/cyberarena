# Plan 010 — UX: mascota Byte, animaciones, navegación y orden de contenidos

- **Espec:** [spec.md](./spec.md)
- **Creado:** 2026-11-02

## 1. Versiones y docs verificadas (2026-11-02)

| Pieza | Versión | Fuente |
|---|---|---|
| lucide-react | 1.66.0 | npm (`npm view lucide-react version`) |
| geist (fuentes autoalojadas, sin red en build) | 1.9.0 (peer `next >=13.2.0`) | npm |
| next `useLinkStatus` | disponible en 16.4.3 (`next/link`) | `next/dist/client/app-dir/link.d.ts` |
| Tailwind `@theme` / `--animate-*` | 4.3.3 (ya instalado) | docs Tailwind v4 |
| Librería de animación | **ninguna** | ADR-014 |

## 2. Decisiones (ADR)

- **ADR-014** — Animación CSS-first y mascota Byte como SVG inline:
  keyframes/transitions/`@starting-style`/scroll-driven con `@supports`; Byte es un
  componente sin hooks (Server Component compatible) cuyo estado es `data-mood`;
  reacciones vía contexto cliente `ByteProvider`; mensajes en i18n; política global de
  `prefers-reduced-motion`.

## 3. Estructura nueva

```
apps/web/
  app/[locale]/
    layout.tsx            # shell: SiteHeader + main#main + SiteFooter + ByteProvider/Companion
    template.tsx          # animación de entrada de página
    loading.tsx / error.tsx / not-found.tsx
    dev/byte/page.tsx     # galería de estados (solo dev)
    paths/loading.tsx, paths/[slug]/loading.tsx, rooms/[slug]/loading.tsx
  components/
    byte/  byte.tsx byte.module.css byte-bubble.tsx byte-scene.tsx confetti.tsx
           byte-provider.tsx byte-companion.tsx
    shell/ site-header.tsx nav-link.tsx mobile-nav.tsx site-footer.tsx breadcrumbs.tsx
    icon.tsx skeleton.tsx
apps/api/src/catalog/room-context.ts (+ .spec.ts)
packages/content/translations/en/_catalog.json
packages/content/content/modules/{passwords,red-team-ops}.json
```

## 4. Reestructuración de contenidos

| Path (order) | Módulos en orden |
|---|---|
| CS101 (1) | start-your-cyber-journey → linux-fundamentals → networking (redes-fundamentos, seguridad-wireless, redes-wireshark) → windows-ad-fundamentals → command-line → cryptography (criptografia-basica, steganography, criptografia-pki) → web-hacking → owasp-top-10 → exploitation-basics → offensive-tooling → defensive-security → security-solutions → defensive-tooling → cyber-career |
| JrPT (2) | pentest-foundations → recon-pasivo → recon-activo → nmap → burp-suite → scripting → privesc → passwords (password-attacks) → pivoting → active-directory |
| WebApp (3) | sqli → xss → ssrf → injection-misc → auth → api-logic → mobile (mobile-security) |
| Advanced (4) | web-red-team (web-red-team) → ad-avanzado → red-team-ops (detection-evasion, data-exfiltration) → containers-cloud → ai-llm-exploitation → binary-exploitation |

## 5. Verificación

- Vitest: `room-context`, nivel en respuesta, orden `recommended`/`difficulty`,
  `order`/EN de paths y módulos.
- Seed doble contra BD dev; comprobar pertenencias y `CatalogPath.order`.
- E2E: existentes + `navigation.spec.ts` + `byte.spec.ts`.
- Recorrido manual `/es` y `/en`, 1440 px y 390 px, reduced-motion emulado.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Conflicto con la sesión de 106 | Commits pequeños, no tocar `specs/106-*`, certificado al final |
| E2E dependientes de textos | Conservar textos clave o actualizar specs en el mismo commit |
| Mover rooms descuadra BD | T021 (seed reconecta) antes de T022–T024 |
| Byte invasivo | Modos mini/off, reduced-motion, se aparta con foco en formularios |
| Rendimiento | Sin runtime JS de animación; Byte SSR |
