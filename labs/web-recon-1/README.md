# Lab web-recon-1

Room: **recon-web-basico** (Cyber Security 101). Objetivo: primer reconocimiento web
con `curl` — robots.txt, rutas ocultas y cabeceras de respuesta.

## Máquinas

| Servicio | Imagen | Puerto (host) |
|---|---|---|
| web | nginx:1.29-alpine | `127.0.0.1:18080` |

## Despliegue

```bash
cp flags.env.example flags.env      # primera vez: define FLAG_1 y FLAG_2
docker compose -f labs/web-recon-1/compose.yaml --env-file labs/web-recon-1/flags.env up -d
# ... practicar ...
docker compose -f labs/web-recon-1/compose.yaml --env-file labs/web-recon-1/flags.env down -v   # SIEMPRE al terminar
```

## Flags

- `FLAG_1` — escondida en el sitio (recon de contenido).
- `FLAG_2` — escondida en las cabeceras de respuesta (recon HTTP).

**Convención**: los valores de `flags.env` deben coincidir EXACTAMENTE con las
respuestas de `packages/content/private/answers/recon-web-basico.yaml` (mismas
mayúsculas/minúsculas recomendadas; la comparación es case-insensitive). El pipeline
no puede validar esta coincidencia (el env no se commitea): revisión humana.

## Prerrequisitos

Docker. Ninguna herramienta extra: todo se resuelve con `curl`.
