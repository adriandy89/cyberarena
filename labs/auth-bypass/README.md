# Lab auth-bypass

Room: **auth-bypass** (NUEVA — WebApp Pentesting). Tres niveles de autenticación.

## Niveles

| Nivel | URL | Técnica |
|---|---|---|
| 1: Basic Auth | `/level1` | Credenciales débiles (admin:admin123) |
| 2: JWT | `/level2?token=X` | Algorithm none + cambiar role a admin |
| 3: IDOR | `/api/user/1` | Cambiar ID para ver datos de otro usuario |

## Flags
- FLAG_1 — Basic Auth bypass
- FLAG_2 — JWT none algorithm
- FLAG_3 — IDOR (en /api/user/1 campo "secret")
