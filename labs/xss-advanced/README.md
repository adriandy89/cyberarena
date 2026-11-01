# Lab xss-advanced

Room: **xss-reflejado** (task adicional). XSS avanzado: DOM, filter bypass, CSP.

## Endpoints
| URL | Tipo | Vector |
|---|---|---|
| `/dom#PAYLOAD` | DOM-based | location.hash → innerHTML |
| `/filtered?input=X` | Filter bypass | filtro quita `<script>` pero no `<img onerror>` |
| `/csp?input=X` | Weak CSP | `'unsafe-inline'` permite scripts inline |

## Flags
- FLAG_1 — en variable JS de /dom (visible con XSS que ejecute)
- FLAG_2 — en data-flag attribute de /filtered (bypass del filtro)
- FLAG_3 — en div oculto de /csp (unsafe-inline permite leerlo)
