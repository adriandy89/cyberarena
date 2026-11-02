# Lab template

Cada room práctico tiene su **propio stack de Docker Compose aislado** en `labs/<room-slug>/`.
Este template es el patrón obligatorio (constitución §1.4, ADR-006 y ADR-015). El lint del
lab-runner (`pnpm --filter @repo/lab-runner manifest`, parte de `pnpm build`) rechaza cualquier
compose que no cumpla estas reglas.

## Reglas

1. **Red aislada**: una red `lab-<room-slug>` propia; JAMÁS conectar a las redes del stack
   de la aplicación (`cyberarena-dev_frontend/backend` ni producción).
2. **Puertos**: solo los necesarios, siempre en `127.0.0.1:` y sin repetir los de otro lab.
3. **Flags**: los valores viven en `flags.env.example` (y, si se quiere sobrescribir en local, en
   `flags.env`, gitignored) y coinciden con `packages/content/private/answers/<room>.yaml`. El
   compose solo interpola `${FLAG_n}`; el MDX del room nunca contiene el valor.
4. **Efímero**: `restart: "no"` (un lab nunca vuelve solo tras reiniciar Docker) y `down -v`
   siempre al terminar. Desde la fase 011 el lab-runner los apaga solo cuando nadie los usa.
5. **Hardening**: `cap_drop: [ALL]` + `cap_add` de la lista blanca (CHOWN, SETUID, SETGID,
   DAC_OVERRIDE, FOWNER, NET_BIND_SERVICE), `no-new-privileges`, imágenes con tag fijo (nunca
   `latest` ni `build:`), límites `mem_limit` (≤512m), `cpus` (≤1) y `pids_limit` (≤256).
6. **Volúmenes**: solo binds relativos de solo lectura (`./site:/site:ro`) o volúmenes con nombre
   declarados en el propio compose. Nunca rutas del host ni `docker.sock`.
7. **Metadatos** `x-cyberarena:` con `access: http|exec`, `url` opcional y, si hace falta, una
   excepción documentada (`rule`, `service`, `reason`) para `cap-drop`, `cap-add`,
   `security-opt` o `limits`.
8. README por lab: objetivo, máquinas, puertos, pista de despliegue y prerrequisitos.

## Estructura esperada por room

```
labs/<room-slug>/
├── compose.yaml        # servicios vulnerables, red aislada, puerto loopback, x-cyberarena
├── site/               # ficheros del servicio (montados :ro)
├── flags.env.example   # FLAG_1=FLAG{...}, FLAG_2=...
└── README.md           # objetivo y contexto del lab
```
