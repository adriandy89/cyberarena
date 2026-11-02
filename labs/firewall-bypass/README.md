# Lab firewall-bypass

Room: **web-red-team** (task adicional, Tier 3). Reglas de firewall y evasión.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# :18180 intranet "bloqueada" | :18443 gateway abierto | :18844 admin
```

| Técnica | Cómo |
|---|---|
| F1: túnel por puerto permitido | `curl "http://127.0.0.1:18443/fetch?url=http://intranet.local/"` — el 443 está permitido y reenvía al 80 bloqueado |
| F2: source port 53 | Desde DENTRO de la red del lab (el NAT de Docker reescribe el puerto origen desde fuera): `docker exec <lab> python -c "...bind(53)..."` — regla que allowlista el puerto ORIGEN 53 (DNS) |

## Nota sobre el source port
El check es real: el servicio :8443 solo acepta conexiones cuyo puerto
origen == 53 (la clasica regla `--sport 53 allow`). Desde fuera del docker
network el proxy NAT reescribe el puerto, por eso el ataque se lanza desde
dentro (pivot) — exactamente como en un engagement real.
