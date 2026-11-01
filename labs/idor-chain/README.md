# Lab idor-chain

Room: **owasp-top-10** (task adicional). IDOR encadenado en una API REST.

## Ataques a probar
| Endpoint | Ataque | Resultado |
|---|---|---|
| `/api/user/1` | Cambiar ID de 2→1 | Datos del admin (incluye api_key) |
| `/api/user/1?expand` | Añadir ?expand | Campo `secret` con FLAG |
| `/api/user/4` | Acceder a cuenta de servicio | api_key + FLAG |
| `/api/order/1002` | Ver pedido de otro | internal_note con FLAG |
| `/api/me?user_id=1&role=admin` | Mass assignment | Te conviertes en admin |

## Flags
- FLAG_1 — admin secret (via IDOR + expand)
- FLAG_2 — service account secret
- FLAG_3 — admin order internal note
