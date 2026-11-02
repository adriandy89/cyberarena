# Lab api-bola-bfla
Room: **api-security** (NUEVA). OWASP API Top 10 vulnerabilities.
| Ataque | Endpoint | Cómo |
|---|---|---|
| BOLA | GET /api/orders/1002 | Ver order de otro usuario |
| BFLA | DELETE /api/users/3 | Borrar usuario sin ser admin |
| Mass Assignment | POST /api/orders/create | Enviar {"role":"admin"} |
| Resource | GET /api/export | Dump completo sin rate limit |
