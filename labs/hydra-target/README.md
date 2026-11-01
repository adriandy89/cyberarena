# Lab hydra-target

Room: **herramientas-ofensivas** (CS101). Login form para fuerza bruta.

## Usuarios (passwords de rockyou.txt top-100)
| Usuario | Password | Flag |
|---|---|---|
| admin | summer2014 | FLAG_1 |
| svc_backup | changeme | FLAG_2 |
| guest | guest | sin flag (calentamiento) |

## Uso con hydra (GET form)
```bash
hydra -l admin -P /usr/share/wordlists/rockyou.txt 127.0.0.1 http-get-form \
  "/login:username=^USER^&password=^PASS^:incorrect" -t 4
```

## Uso con ffuf
```bash
ffuf -w /usr/share/wordlists/rockyou.txt \
  -u "http://127.0.0.1:18090/login?username=admin&password=FUZZ" \
  -fc 401
```
