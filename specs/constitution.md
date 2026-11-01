# Constitución del proyecto — CyberArena

> Principios NO negociables. Toda especificación, plan, tarea y línea de código debe
> conformarse a estos principios. Ante conflicto, gana este documento.

## 1. Seguridad primero

1.1. **Ningún secreto se commitea** (`.env` fuera de git; plantillas `.env.example` siempre actualizadas al añadir variables).
1.2. **Las respuestas/flags nunca viajan al cliente** ni quedan en bundles estáticos: viven server-side (hash en BD) y se validan por API.
1.3. **Todo contenedor sigue el checklist OWASP Docker**: usuario no-root, `cap_drop: ALL` salvo necesidad documentada, healthcheck, imagen mínima, redes segmentadas.
1.4. **Los labs corren en redes Docker aisladas** sin acceso a la red de la aplicación ni a datos de producción.
1.5. Validación de toda entrada en la API con Zod (Standard Schema); rate-limiting activo por defecto.
1.6. Los contenidos ofensivos son **con fines educativos en entornos locales controlados**; nada de targeting externo, malware real ni evasion para uso malicioso.

## 2. Documentación y versiones actualizadas

2.1. **Antes de añadir o actualizar cualquier dependencia se verifica la versión estable vigente y la documentación oficial** (npm view / docs oficiales). Se prohíbe instalar RC/dev salvo decisión explícita en un ADR.
2.2. Las versiones se **fijan** (exactas o rango menor acotado) para reproducibilidad.
2.3. Toda decisión arquitectónica relevante se registra en `docs/adr/` (ADR breve: contexto → decisión → consecuencias).

## 3. SDD: las specs mandan

3.1. Ninguna feature se implementa sin su carpeta `specs/<NNN-slug>/` con `spec.md` (QUÉ), `plan.md` (CÓMO) y `tasks.md` (checklist).
3.2. **Si el código y la spec discrepan, se corrige el más antiguo de forma consciente y se documenta** — no se deja drift silencioso.
3.3. Cada tarea termina en **commit atómico** referenciando su id (`T012`) en el mensaje.
3.4. Las specs son documentos vivos: se editan (con fecha) en lugar de re-generarse desde cero.

## 4. Resistencia a reinicios

4.1. El estado del trabajo vive en el repo (specs + docs + git), **nunca en la memoria de una conversación**.
4.2. `tasks.md` con checkboxes es el mecanismo de reanudación: una sesión nueva empieza por `AGENTS.md` → primer checkbox sin marcar.
4.3. Toda sesión que cambie decisiones o avance fase debe dejar el rastro actualizado (checkboxes, ADR si aplica, changelog de la spec).

## 5. Calidad

5.1. La lógica de negocio (XP, progreso, streaks, validación de flags) **va cubierta de tests** (Vitest). La UI se verifica con smoke tests.
5.2. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde antes de cada commit de tarea. CI lo refuerza.
5.3. Content-as-code: el contenido se valida en build (schemas Zod); un room inválido rompe el build, no producción.
5.4. Convención de commits [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).

## 6. Producto

6.1. Bilingüe ES/EN desde el diseño: UI con i18n (`/es`, `/en`); contenido en español con estructura preparada para traducción.
6.2. El contenido educativo es **original** (redacción propia); puede inspirarse en currículos públicos (THM, OSCP, OWASP) pero nunca copiar material de terceros.
6.3. Todo despliegue es **Docker con compose, stacks separados por carpetas** (`infra/stacks/*`), reproducible con un comando.
6.4. Lo simple gana: no se añade infraestructura hasta que la fase la exija (los labs en navegador tipo Kasm quedan explícitamente fuera del alcance v1 — ver roadmap).
