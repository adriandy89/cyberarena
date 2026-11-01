# Lab xss-reflejado

Room: **xss-reflejado** (WebApp Pentesting).

## Endpoints vulnerables

| URL | Vector |
|---|---|
| `/hello?name=X` | Reflected XSS (input va directo al HTML) |
| `/post?name=X&message=Y` | Stored XSS (guardado en guestbook) |
| `/search?q=X` | Reflected en mensaje de error |

## Flags

- `FLAG_1` — se revela al buscar "XSS" (el payload correcto ejecuta y muestra la flag)
- `FLAG_2` — escondida en el guestbook (visible con XSS que ejecute document.body.innerHTML)

**Convención**: los valores deben coincidir con `private/answers/xss-reflejado.yaml`.
