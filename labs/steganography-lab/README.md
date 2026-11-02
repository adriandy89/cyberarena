# Lab steganography

Room: **steganography** (NUEVA, Tier 2). Ocultación en imágenes y binarios.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# http://127.0.0.1:18105
```

| Archivo | Técnica | Extracción |
|---|---|---|
| `bmp-lago.bmp` | LSB en píxeles (longitud + mensaje, 1 bit por canal) | python/zsteg-style script |
| `vacaciones.jpg` | Segmento COM de JPEG | `strings` / `exiftool` |
| `logo-corp.png` | ZIP embebido tras IEND | `binwalk` / `unzip` tras separar |

## Verificación rápida
```bash
curl -O http://127.0.0.1:18105/vacaciones.jpg && strings vacaciones.jpg | grep FLAG
curl -O http://127.0.0.1:18105/logo-corp.png && binwalk logo-corp.png   # zip @ offset
```
