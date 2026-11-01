# Data model 000 — Foundation

Modelo mínimo de F0. Evoluciona en F1 (auth) y F2 (contenido). La fuente real es
`packages/database/prisma/schema.prisma`.

## Entidades (F0)

### User (placeholder — F1 lo sustituye por el modelo Better Auth)

| Campo | Tipo | Nota |
|---|---|---|
| id | String @id | cuid |
| email | String @unique | |
| name | String? | |
| role | Enum Role | `STUDENT` \| `ADMIN` (default STUDENT) |
| createdAt/updatedAt | DateTime | |

## Tipos compartidos v1 (packages/shared)

Definidos en TypeScript (sin persistencia aún; F2 los persiste):

```
Path { slug, title, description, level (beginner|intermediate|advanced), modules: Module[] }
Module { slug, title, description, rooms: Room[] }
Room { slug, title, description, difficulty (info|easy|medium|hard|insane),
       type (walkthrough|challenge|capstone), estimatedMinutes, tags[], tasks: Task[] }
Task { index, title, questions: Question[] }
Question { id, prompt, hint?, kind (flag|text|choice), xp (derived from room.type) }
```

## Constantes de gamificación (packages/shared, con tests)

- `XP_PER_QUESTION = { walkthrough: 10, challenge: 30, capstone: 40 }`
- `LEVELS`: 21 rangos con umbrales XP acumulado (0 → 150000), estilo THM adaptado.
- `DIFFICULTIES`: info|easy|medium|hard|insane con etiquetas y colores base.
- `STREAK_MIN_QUESTIONS_PER_DAY = 3`

## Entidades futuras (referencia, no implementar en F0)

Session/Account (Better Auth, F1) · Path/Module/Room/Task/Question persistidos (F2) ·
RoomProgress/QuestionAttempt/XpEvent (F3) · Badge/UserBadge/Streak/Certificate (F5) ·
LabSession (F7).
