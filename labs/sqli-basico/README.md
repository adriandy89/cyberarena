# Lab sqli-basico

Room: **sqli-basico** (Web Application Pentesting). Una tienda real (TechShop) con
SQL injection en `/search` y `/login`.

## Despliegue

```bash
cp flags.env.example flags.env
docker compose -f labs/sqli-basico/compose.yaml --env-file labs/sqli-basico/flags.env up -d
```

## Endpoints vulnerables

| URL | Parámetro | Vector |
|---|---|---|
| `/search?q=PRODUCTO` | `q` | LIKE injection |
| `/login?username=X&password=Y` | ambos | login bypass |

## Flags

- `FLAG_1` — en la columna `secret` de la tabla `users` (dumpear con UNION)
- `FLAG_2` — en la columna `description` de un producto (buscar con LIKE)

**Convención**: los valores deben coincidir con `private/answers/sqli-basico.yaml`.
