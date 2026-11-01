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
└── private/answers/<room-slug>.yaml         # respuestas (server-side only)
```

## Ejemplo mínimo

`content/paths/cyber-security-101.json`:
```json
{
  "slug": "cyber-security-101",
  "title": "Cyber Security 101",
  "description": "...(≥10 chars)...",
  "level": "beginner",
  "modules": [{ "slug": "start-your-cyber-journey" }]
}
```

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
```

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

## Flujo de publicación

```bash
pnpm --filter @repo/content build   # valida y compila (rompe si algo está mal)
pnpm db:seed                        # sincroniza a BD (idempotente; borra lo ausente)
```

CI ejecuta el build de contenido en cada push: un room inválido rompe el pipeline antes
de llegar a ningún entorno.
