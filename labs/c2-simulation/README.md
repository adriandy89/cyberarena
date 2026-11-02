# Lab c2-simulation

Room: **detection-evasion** (Tier 1 — NUEVA). C2 beaconing, jitter, DNS exfiltration y detección blue team.

## Uso

```bash
cp flags.env.example flags.env   # editar flags
docker compose --env-file flags.env up -d
# http://127.0.0.1:18103
```

## Flujo de aprendizaje

1. **Atacante ruidoso**: enviar 3+ beacons SIN jitter:
   `curl "http://127.0.0.1:18103/beacon?id=implant1&interval=5"` (x3)
2. **Detectar**: `curl http://127.0.0.1:18103/detect` → alerta `FIXED_INTERVAL_BEACON` + FLAG_1
3. **Atacante sigiloso**: 3+ beacons CON jitter (`/beacon-jitter?...&jitter=40`) → `/detect` no genera firma
4. **DNS exfil**: `curl "http://127.0.0.1:18103/dns?q=<subdominio-largo>.example.com"` → FLAG_2
5. **Correlación**: cuando `/detect` ve 2+ alertas (o una CRITICAL) → FLAG_3

## Flags

| Flag | Cómo se obtiene |
|---|---|
| FLAG_1 | Defensor detecta beaconing de intervalo fijo (3+ beacons sin jitter) |
| FLAG_2 | Exfiltración DNS exitosa (query > 30 chars) |
| FLAG_3 | Motor de correlación cruza 2+ alertas / detecta CRITICAL |

## Puertos

`127.0.0.1:18103` → contenedor 8080
