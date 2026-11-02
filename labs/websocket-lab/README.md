# Lab websocket-lab

Room: **websocket-security** (NUEVA, Tier 3). Servidor WebSocket RFC 6455 en asyncio puro.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# ws://127.0.0.1:18110/chat?user=you  |  ws://127.0.0.1:18110/admin
```

| Vulnerabilidad | Explotación |
|---|---|
| Message injection | Enviar {"from":"admin","text":"..."} — el servidor confía el campo from |
| Socket admin sin auth/Origin | Conectar directo a /admin y mandar {"cmd":"dump"} |

## Cliente
```bash
websocat "ws://127.0.0.1:18110/chat?user=attacker"
```
o cualquier snippet python `websockets`/JS `new WebSocket(...)`.
