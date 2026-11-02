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

## Labs (fases 007 y 011)

Los rooms con laboratorio declaran en el frontmatter `lab: <slug>` y opcionalmente
`labUrl` (la URL del servicio principal, ej. `http://127.0.0.1:18080` — validación:
`labUrl` exige `lab`). Si alguna tarea usa un **segundo lab**, decláralo en
`extraLabs: [<slug>]` (requiere `lab`; no puede repetirlo). El build comprueba que cada
slug tiene su `labs/<slug>/compose.yaml`.

El room player muestra el **LabPanel**:

- con `LABS_ENABLED=true` (fase 011, ADR-015) el estudiante arranca el lab con un clic; corre
  en el servidor, se comparte entre quienes lo usan a la vez y se apaga solo (10 min sin la
  página abierta, 2 h por sesión ampliables a 4 h, 1 lab por estudiante, 3 a la vez);
- sin él, muestra los comandos `docker compose` para levantarlo a mano.

Patrón de lab declarativo (ver `labs/_template/` y `labs/web-recon-1/`):

```
labs/<slug>/
├── compose.yaml        # imagen pública con tag fijo + bloque x-cyberarena
├── site/               # ficheros del servicio (montados :ro)
├── README.md           # objetivo, servicios, puertos, prerrequisitos
└── flags.env.example   # FLAG_n=FLAG{...}: los valores reales del lab
```

```yaml
name: lab-<slug>
x-cyberarena:
  access: http            # http: enlace a `url` (o al primer puerto tcp); exec: docker exec
  # url: http://127.0.0.1:18080/
  # exceptions:           # solo cap-drop, cap-add, security-opt o limits, siempre con motivo
  #   - { rule: limits, service: web, reason: "por qué necesita más de 512m / 1 CPU / 256 pids" }
services:
  web:
    image: python:3.12-alpine
    volumes: ['./site:/site:ro']
    environment:
      FLAG_1: ${FLAG_1:?set FLAG_1}
    ports: ['127.0.0.1:18117:8080']
    cap_drop: [ALL]
    cap_add: [CHOWN, SETUID, SETGID]
    security_opt: [no-new-privileges:true]
    restart: "no"
    mem_limit: 256m
    cpus: 0.5
    pids_limit: 128
    networks: [lab]
networks:
  lab:
    name: lab-<slug>
```

**Lint obligatorio** (`pnpm --filter @repo/lab-runner manifest`, parte de `pnpm build`):
puertos solo en `127.0.0.1` y únicos entre labs; nada de `privileged`, red/pid/ipc del host,
dispositivos ni `build:`; volúmenes solo `./relativos:ro` o con nombre (nunca `docker.sock`
ni rutas absolutas); `cap_drop: [ALL]` + `cap_add` de la lista blanca (CHOWN, SETUID, SETGID,
DAC_OVERRIDE, FOWNER, NET_BIND_SERVICE); `no-new-privileges`; límites `mem_limit` ≤ 512m,
`cpus` ≤ 1, `pids_limit` ≤ 256; `restart: "no"`; solo se interpolan `${FLAG_n}` definidas en
`flags.env.example`.

**«Listo» ≠ «contenedor arrancado»**: la app tarda unos segundos en escuchar (los labs Python
~2 s). Explícalo en la tarea si el lab necesita más.

**Convención flags↔respuestas (revisión humana)**: los valores de `flags.env.example`
deben coincidir con `private/answers/<room>.yaml` (la comparación es case-insensitive).
Para el lab-runner, `infra/scripts/lab-flags.sh <dir>` copia esos ficheros (o un
`flags.env` local, gitignored, si existe) al directorio de flags que monta el runner.

Comprueba un lab nuevo de punta a punta con el smoke:
`node infra/scripts/labs-smoke.mjs --runner cyberarena-dev-lab-runner-1 <slug>`.

## Flujo de publicación

```bash
pnpm --filter @repo/content build   # valida y compila (rompe si algo está mal)
pnpm db:seed                        # sincroniza a BD (idempotente; borra lo ausente)
```

CI ejecuta el build de contenido en cada push: un room inválido rompe el pipeline antes
de llegar a ningún entorno.
