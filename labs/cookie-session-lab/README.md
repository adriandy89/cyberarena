# Lab cookie-session
Room: **session-security** (NUEVA). Sesiones predecibles, cookies sin flags, JWT sin exp.
| Endpoint | Ataque |
|---|---|
| `/login` | Session IDs sequenciales (100-109). Admin = 99 |
| `/whoami` | Robar identidad con session=99 |
| `/api-jwt` | Replay de JWT expirado (server no chequea exp) |
