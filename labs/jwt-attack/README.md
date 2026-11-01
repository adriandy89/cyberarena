# Lab jwt-attack

Room: **jwt-security** (NUEVA — WebApp Pentesting). JWT vulnerabilities reales.

## Endpoints
| URL | Ataque |
|---|---|
| `/` | Te da un token JWT válido (role:user) |
| `/login?token=X` | Verifica el token: alg:none + role:admin = todas las flags |
| `/crack` | Hash SHA256 del secret débil (para crackear con rockyou) |
| `/strong` | Token con secret FUERTE (para comparar) |

## Los 3 ataques
1. **alg:none**: decodifica el header, cambia `"alg":"HS256"` → `"alg":"none"`, cambia `"role":"user"` → `"role":"admin"`, elimina la firma
2. **Weak secret**: crackea el hash de `/crack` con rockyou.txt → el secret es `jwt_secret` → firma tus propios tokens
3. **Strong secret comparison**: `/strong` demuestra que un secret largo es incrackeable

## Flags
- FLAG_1 — alg:none bypass
- FLAG_2 — weak secret crack + token forjado
- FLAG_3 — admin total (cualquier método que llegue a role:admin)
