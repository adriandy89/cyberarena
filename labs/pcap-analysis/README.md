# Lab pcap-analysis

Room: **redes-wireshark** (task adicional, Tier 2). Análisis de capturas .pcap reales.

## Uso

```bash
cp flags.env.example flags.env   # editar flags
docker compose --env-file flags.env up -d
# http://127.0.0.1:18104
```

## Capturas generadas (stdlib puro, Wireshark las disecta completo)

| Archivo | Escenario | Flag escondida en |
|---|---|---|
| `capture-http.pcap` | Panel admin sobre HTTP plano | Header `Authorization: Basic` (base64) |
| `capture-ftp.pcap` | Login FTP y descarga de backup | Comando `PASS` en claro |
| `capture-dns.pcap` | Navegación normal + túnel DNS | Subdominio base32 de `tunnel.evil-c2.example` |

## Cómo analizarlas

```bash
curl -O http://127.0.0.1:18104/capture-http.pcap
wireshark capture-http.pcap          # filtro: http.authorization
# o sin GUI:
strings capture-http.pcap | grep Basic | base64 -d   # creds: admin:FLAG{...}

curl -O http://127.0.0.1:18104/capture-ftp.pcap
strings capture-ftp.pcap | grep PASS                  # FTP va en claro

curl -O http://127.0.0.1:18104/capture-dns.pcap
# en Wireshark: dns && dns.qry.name contains "tunnel"
# el subdominio largo es base32: decodificar con echo <sub> | base32 -d
```

## Puertos

`127.0.0.1:18104` → contenedor 8080 (http.server sobre /captures)
