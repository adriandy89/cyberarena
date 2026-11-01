# Lab dns-enumerate

Room: **recon-pasivo-osint** (task adicional). Enumeración DNS: zone transfer.

## Endpoints
| URL | Qué hace |
|---|---|
| `/dig?name=X` | Consulta un registro DNS |
| `/axfr?server=ns1.victima.com` | Zone transfer (volcado completo) |

## Flags
- FLAG_1 — en la nota de staging.victima.com (visible via AXFR)
- FLAG_2 — en la nota de internal.victima.com (visible via AXFR)
