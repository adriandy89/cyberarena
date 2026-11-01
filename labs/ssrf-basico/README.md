# Lab ssrf-basico

Room: **ssrf-basico** (WebApp Pentesting). Un servicio "URL Fetcher" que hace peticiones
a cualquier URL que el usuario proporcione — incluyendo servicios internos.

## Endpoints

| URL | Descripción |
|---|---|
| `/fetch?url=...` | Fetch cualquier URL (VULNERABLE) |
| `/internal?path=...` | API interna (no debería ser accesible) |

## Rutas internas a descubrir

- `/internal?path=/health` — health check
- `/internal?path=/config` — configuración con flag
- `/internal?path=/metadata` — metadata de cloud (como AWS)

## Flags

- `FLAG_1` — en `/config` (via SSRF al endpoint interno)
- `FLAG_2` — en `/metadata` (via SSRF al metadata de cloud)
