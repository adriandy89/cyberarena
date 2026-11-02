# Spec 014 — Publicación open source

- **Estado:** en curso
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión. Petición del usuario:
    - revisar que no haya credenciales en el repositorio;
    - dejar las plantillas de entorno completas y al día;
    - escribir un README profesional **en inglés**, por secciones y con la captura de `docs/assets`, que explique el despliegue local paso a paso;
    - avisar cuando todo esté listo. El cambio de visibilidad del repositorio lo hace el usuario.

## 1. Propósito

El repositorio nació como proyecto personal: el README dice "uso personal", no hay licencia y el
arranque local solo se había probado sobre una copia de trabajo ya compilada. Para publicarlo hace falta
que cualquiera pueda clonarlo, arrancarlo siguiendo el README y saber cómo contribuir y reportar fallos.

## 2. Requisitos

1. **Auditoría de credenciales**, sobre el árbol actual y todo el historial de git:
   - ficheros sensibles: `.env`, `secrets/`, claves y certificados;
   - patrones de claves y tokens: claves privadas, AWS, GitHub, Slack, OpenAI/Anthropic y Google;
   - los valores reales de los secretos locales.
   Lo que aparezca se corrige; si algo hubiera llegado al historial, se avisa al usuario antes de publicar.
2. **Plantillas de entorno** (`.env.example` de la raíz, dev, prod, proxy y `lan/env.example`):
   - completas respecto a lo que leen el código y los compose;
   - con valores de ejemplo coherentes entre sí;
   - sin secretos reales.
3. **Arranque local desde un clon limpio:** las dos formas del README (todo en Docker y `pnpm dev` en el host) funcionan tal cual están escritas. Se verifica en un clon nuevo, sin tocar el stack de desarrollo del usuario.
4. **Documentación open source en inglés.** Es una excepción explícita del usuario a "docs en español", limitada a los puntos de entrada públicos:
   - `README.md`;
   - `LICENSE` (MIT);
   - `CONTRIBUTING.md`;
   - `SECURITY.md`.
   Las specs, los ADR, el runbook y el contenido siguen en español.
5. Descripción del proyecto (`package.json` y metadatos de la web) sin "personal".

## 3. Criterios de éxito

- [ ] Ningún secreto real en el árbol ni en el historial (registro de la auditoría en `tasks.md`).
- [ ] Cada variable que leen el código y los compose aparece en su plantilla, como valor o como comentario.
- [ ] Desde un clon limpio, siguiendo el README, la plataforma arranca, se puede iniciar sesión como admin y el catálogo (59 rooms) carga.
- [ ] README en inglés con la captura, licencia, guía de contribución y política de seguridad.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.

## 4. Decisiones y riesgos (para el usuario, antes de publicar)

- **Respuestas y flags en el repositorio.** Por diseño (contenido como código), están en el repo:
  - `packages/content/private/answers/*.yaml`;
  - `labs/*/flags.env.example`.
  Al publicar, cualquiera puede leerlas. Es una plataforma de aprendizaje autoalojada, no un CTF competitivo, así que no se reescribe el historial. Sacarlas exigiría un repositorio privado de contenido (deuda 011 T9xx: rotar flags).
- **Nombre del repositorio** (`tryhackme`). TryHackMe es una marca registrada. Se recomienda renombrar el repo a `cyberarena` antes de hacerlo público; GitHub redirige las URLs antiguas.
- **Licencia MIT** por defecto, para código y contenido. Si el usuario prefiere otra (p. ej. AGPL-3.0 para el código o CC BY-SA 4.0 para el contenido), se cambia antes de publicar.
- El autor de los commits (email) queda visible en el historial público.
