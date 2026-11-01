# Guía de autoría de contenido — CyberArena

> Cómo se escriben paths, módulos, rooms y preguntas. **Estado: v0 (estructura prevista,
> se concreta con código en la fase 002-content-engine).** Esta guía es normativa una vez
> fijada por F2; los ejemplos finales los genera F2.

## Jerarquía

```
Path (ruta, p.ej. cyber-security-101)
 └─ Module (módulo, p.ej. linux-fundamentals)
     └─ Room (room, p.ej. linux-fundamentals-1)
         └─ Task (tarea numerada con guía MDX)
             └─ Question (pregunta con flag/respuesta, hint opcional)
```

## Ubicación en el repo (prevista)

```
packages/content/
├── content/
│   ├── paths/<path-slug>.json                     # metadatos y orden de módulos
│   ├── modules/<module-slug>.json                 # metadatos y orden de rooms
│   └── rooms/<room-slug>/
│       ├── index.mdx                              # frontmatter + intro del room
│       └── tasks/<NN>-<slug>.mdx                  # una tarea: guía + preguntas
└── private/
    └── answers/<room-slug>.yaml                   # SOLO server-side (seed a BD)
```

## Frontmatter de room (borrador — F2 lo valida con Zod)

```yaml
---
slug: linux-fundamentals-1
title: Linux Fundamentals 1
description: Primeros pasos con la terminal de Linux.
difficulty: easy          # info|easy|medium|hard|insane
type: walkthrough          # walkthrough|challenge|capstone
estimatedMinutes: 45
tags: [linux, terminal]
lab: null                  # o <room-slug> si tiene labs/<room-slug>/compose.yaml
locales: [es]              # 'en' se añade al traducir
---
```

## Reglas

1. **Las respuestas NUNCA se escriben en MDX** ni en ningún archivo que se sirva al cliente;
   van en `private/answers/<room-slug>.yaml` con formato `questionId: answer`.
2. Los IDs de pregunta son estables (`room-slug-tNN-qNN`); cambiarlos rompe progreso ya
   registrado — tratar como migración.
3. Flags de labs: formato `FLAG{texto_snake_case}`; el valor real se inyecta por variables
   de entorno del compose del lab y se siembra en BD — nunca hardcode en el MDX.
4. Contenido original: redacción propia; referencias a fuentes públicas permitidas con cita.
5. Español primero (`locales: [es]`); la traducción EN es incremental y nunca bloquea.
6. Cada room debe tener al menos: intro, 2+ tasks con guía, preguntas con hint opcional, y
   resumen. Los capstones no llevan guía (solo contexto y objetivos).

## Pipeline (F2)

1. `pnpm --filter @repo/content build` valida schemas y compila MDX.
2. `pnpm db:seed` sincroniza catálogo (paths/modules/rooms/tasks/questions) a PostgreSQL con
   upserts por slug y respuestas hasheadas.
3. CI valida el contenido en cada PR: un room inválido rompe el build.
