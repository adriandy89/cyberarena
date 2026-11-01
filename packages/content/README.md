# @repo/content

Contenido como código (content-as-code) de CyberArena. **Esta carpeta es un esqueleto
hasta la fase `002-content-engine`**, que añade:

- `content-collections.ts` — definición de colecciones con schemas Zod (paths, modules,
  rooms/tasks) usando [Content Collections](https://www.content-collections.dev).
- `content/paths|modules|rooms/**` — el catálogo en MDX/JSON (ver `docs/content-guide.md`).
- `private/answers/**` — respuestas/flags **server-side only** (se siembran a BD hasheadas;
  jamás se importan desde código de cliente — constitución §1.2).
- Pipeline: build valida → seed sincroniza a PostgreSQL.

Estructura prevista (ver `docs/content-guide.md` y `specs/002-content-engine/` cuando exista):

```
packages/content/
├── content-collections.ts   (fase 002)
├── content/
│   ├── paths/
│   ├── modules/
│   └── rooms/
└── private/
    └── answers/
```
