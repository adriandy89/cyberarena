# Guía de autoría de contenido — CyberArena

> Normativa (fase 002). El pipeline está en `packages/content` (ADR-010):
> JSON + MDX → validación Zod → `dist/catalog.json` + `dist/answers.json` → seed → BD.

## Jerarquía y archivos

```
packages/content/
├── content/
│   ├── paths/<path-slug>.json               # metadatos + orden de módulos
│   ├── modules/<module-slug>.json           # metadatos + orden de rooms
│   └── rooms/<room-slug>/
│       ├── index.mdx                        # frontmatter del room + intro
│       └── tasks/<NN>-<slug>.mdx            # una task: guía + preguntas
├── private/answers/<room-slug>.yaml         # respuestas (server-side only)
└── translations/en/
    ├── _catalog.json                        # EN de títulos/descripciones de paths y módulos
    └── <room-slug>.json                     # EN del room (título, descripción, tareas, preguntas)
```

## Ejemplo mínimo

`content/paths/cyber-security-101.json`:
```json
{
  "slug": "cyber-security-101",
  "title": "Cyber Security 101",
  "description": "...(≥10 chars)...",
  "level": "beginner",
  "order": 1,
  "modules": [{ "slug": "start-your-cyber-journey" }]
}
```

`order` (entero ≥1, único) es la posición de la ruta en el roadmap: la web, el dashboard,
los certificados y hacktivities («Recomendado») siguen ese orden. Dentro de cada ruta, el
orden de módulos y de rooms es el de los arrays de su JSON.

`content/rooms/<slug>/index.mdx` (frontmatter):
```yaml
---
slug: mi-room                    # kebab-case, único
title: "Mi room"
description: "Cuidado con los dos puntos: cita los strings que lleven ': '"
difficulty: easy                 # info|easy|medium|hard|insane
type: walkthrough                # walkthrough|challenge|capstone
estimatedMinutes: 45
tags: [linux, terminal]          # kebab-case, máx 8
lab: null                        # o <slug> si existe labs/<slug>/compose.yaml
---
Intro del room (MDX)...
```

`tasks/01-<slug>.mdx`:
```yaml
---
index: 1                         # 1..99, consecutivos y en orden de archivo
title: "Título de la tarea"
questions:
  - id: mi-room-t01-q01          # <room-slug>-tNN-qNN — ESTABLE, no renombrar jamás
    prompt: "¿...?"
    hint: 'pista opcional o null'
    kind: text                   # flag | text | choice
  - id: mi-room-t01-q02
    prompt: "Elige:"
    hint: null
    kind: choice
    options:
      - { id: a, label: "Opción A" }
      - { id: b, label: "Opción B" }
---
Guía MDX de la tarea...
```

`private/answers/mi-room.yaml`:
```yaml
mi-room-t01-q01: respuesta exacta        # se compara normalizada, case-insensitive
mi-room-t01-q02: a                       # el id de la opción correcta
mi-room-t01-q03:                         # varias aceptadas (fase 107): la primera es la canónica
  - regla de compromiso
  - reglas de compromiso
  - rules of engagement                  # el equivalente inglés para quien estudia en /en
```

**Preguntas justas** (fase 107): si la respuesta es un concepto que se explica con una frase,
pregúntalo como `choice`; una pregunta `text` debe pedir un término corto, un comando o un valor,
con sus variantes razonables (ES/EN, plural, sin tildes) como lista. El build avisa de las
respuestas de texto de 4+ palabras en lenguaje natural.

## Reglas (validadas en build — `pnpm --filter @repo/content build`)

1. **Las respuestas nunca van en MDX** ni en ningún archivo servido al cliente; viven en
   `private/answers` y el seed las guarda **hasheadas** (sha256 normalizado).
2. **Ids estables**: `questionId` y los slugs son claves de progreso. Renombrar = migración
   consciente (rompe historial de estudiantes).
3. El builder rompe si: falta una respuesta, hay respuesta huérfana, un flag no cumple
   `FLAG{...}`, los índices de task no son consecutivos, un id no pertenece a su room,
   hay módulos/rooms huérfanos no referenciados, o cualquier frontmatter viola el schema.
4. **Strings YAML con `": "` se citan** (`title: "Ética: la línea"`) — error clásico.
5. Contenido **original** en español primero; `tags`/slugs siempre en inglés kebab-case.
6. Todo room: intro ≥1 párrafo, ≥1 task con guía real, ≥1 pregunta con hint opcional.
   Los capstones (type: capstone) van sin guía, solo contexto.
7. Flags con `FLAG{snake_case}`; las de labs se inyectan por env del compose del lab
   (fase 007) y se siembran igual por el pipeline.
8. **Orden de rutas** (fase 010): cada path declara `order` único; dos rutas con el mismo
   `order` rompen el build.
9. **Bilingüe obligatorio** (fases 010 y 107): todo path y módulo necesita su entrada en
   `translations/en/_catalog.json`, y todo room su `translations/en/<room>.json` completo: título,
   descripción y, por tarea, `title` y `body`; por pregunta, `prompt`, `hint` (si el español la
   tiene) y `options` (`{ "a": "…" }`) en las de test. Si falta algo, **el build falla**.
   - `pnpm --filter @repo/content exec tsx scripts/build.ts --dry-run --en-report=<slug>` lista
     lo que falta sin escribir `dist/`; `--allow-en-gaps` solo para borradores locales.
   - En el cuerpo EN, los bloques de código se copian idénticos: solo se traducen los comentarios.
10. **Avisos de orden** (no bloquean, pero revísalos): el build avisa si un room es más fácil
    que el anterior de su módulo (los `info` no cuentan) o si una tarea enlaza
    `/rooms/<slug>` a un room que llega más tarde. Evita frases como «el siguiente módulo»
    cuando el contenido está en otra ruta: nombra la ruta o el módulo.

## Labs (fase 007)

Los rooms con laboratorio declaran en el frontmatter `lab: <slug>` y opcionalmente
`labUrl` (la URL del servicio principal, ej. `http://127.0.0.1:18080` — validación:
`labUrl` exige `lab`). El room player muestra el **LabPanel** con los comandos up/down.

Patrón de lab declarativo (ver `labs/web-recon-1/` como referencia):

```
labs/<slug>/
├── compose.yaml        # imagen pública + entrypoint que sustituye placeholders
├── site/               # plantillas con __FLAG_n__ (montadas read-only)
├── README.md           # objetivo, servicios, puertos, prerrequisitos
└── flags.env.example   # FLAG_n=placeholder (flags.env real va gitignored)
```

**Convención flags↔respuestas (revisión humana)**: los valores de `flags.env` del lab
deben coincidir con `private/answers/<room>.yaml` (la comparación es case-insensitive).
El pipeline NO puede validar esta coincidencia (el env no se commitea): al crear un
lab, verifica ambos lados antes de publicar el room.

Reglas de seguridad del lab (ya en la plantilla y en `labs/_template`): red interna
aislada, puertos publicados solo en `127.0.0.1`, `cap_drop: ALL` + caps mínimas,
`no-new-privileges`, y `down -v` SIEMPRE al terminar.

## Flujo de publicación

```bash
pnpm --filter @repo/content build   # valida y compila (rompe si algo está mal)
pnpm db:seed                        # sincroniza a BD (idempotente; borra lo ausente)
```

CI ejecuta el build de contenido en cada push: un room inválido rompe el pipeline antes
de llegar a ningún entorno.
