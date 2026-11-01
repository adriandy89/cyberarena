# Data model 001 — Auth & Users

Fuente real: `packages/database/prisma/schema.prisma` (migración `0002_auth`).

## Tablas better-auth (core) + extensión propia

### User (extendida — reemplaza el placeholder de F0)

| Campo | Tipo | Nota |
|---|---|---|
| id | String @id | generado por better-auth (text) |
| name | String | requerido en sign-up |
| email | String @unique | |
| emailVerified | Boolean @default(false) | |
| image | String? | avatar futuro |
| role | Role @default(STUDENT) | **propio** (additionalField) |
| createdAt / updatedAt | DateTime | |

Relaciones: `sessions Session[]`, `accounts Account[]`.

### Session

`id, expiresAt, token @unique, createdAt, updatedAt, ipAddress?, userAgent?, userId → User (Cascade)`

### Account (credenciales email/password)

`id, accountId, providerId, userId → User (Cascade), accessToken?, refreshToken?, idToken?,
accessTokenExpiresAt?, refreshTokenExpiresAt?, scope?, password? (hash scrypt),
createdAt, updatedAt` + `@@unique([providerId, accountId])`

### Verification (tokens de verificación/reset)

`id, identifier (email), value (token hash), expiresAt, createdAt, updatedAt`

## Contratos API nuevos

```
GET    /api/users/me           → { id, name, email, emailVerified, role }  [sesión]
GET    /api/users?take&cursor  → { users: [...], nextCursor }              [ADMIN]
PATCH  /api/users/:id/role     → { id, role }   body { role: 'STUDENT'|'ADMIN' } [ADMIN]
GET    /api/auth/*             → better-auth (sign-up/email, sign-in/email,
                                 sign-out, get-session, forgot-password, …)
```

Errores: 401 sin sesión, 403 rol insuficiente, 400 validación (Zod) / auto-degradación.

## Reglas de negocio (con tests)

- `shouldBootstrapAdmin(existingUserCount)` → count === 0 ⇒ ADMIN.
- Cambio de rol: actor ADMIN; target ≠ actor (no auto-degradarse).
- `role` nunca llega como campo editable desde sign-up (lo fija el hook).
