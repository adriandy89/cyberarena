# Lab file-upload

Room: **file-upload** (NUEVA — WebApp Pentesting).

## Endpoints

| URL | Función |
|---|---|
| `/upload` (POST) | Upload con blacklist de extensiones |
| `/files` | Lista archivos subidos + flags plantadas |
| `/files/NAME` | Ver contenido de archivo |

## Flags
- FLAG_1 — en /files/flag_level1.txt (accesible directamente)
- FLAG_2 — en /files/flag_level2.txt (requiere descubrimiento)
- FLAG_3 — en /files/.env (archivo oculto)
