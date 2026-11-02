# Tasks 013 — Despliegue en la LAN (mini PC)

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

- [x] T001 spec + tasks 013; ROADMAP.
- [x] T002 lab-runner `LAB_BIND_ADDRESS`/`LAB_PUBLIC_HOST`; api `publicHost`; web: host de los labs en el
      contenido y en el panel; tests; ADR-015 (consecuencia).
- [x] T003 Kit `infra/stacks/lan/` (overlay, plantilla de `.env`, `cyberarena.sh`, README) y opciones del
      smoke para un stack fuera del repo.
- [x] T004 Despliegue en el mini PC (`~/cyberarena/{repo,stack}`), smoke y labs desde el PC del usuario;
      registro.

## Registro

### 2026-11-02 — T004, despliegue en el mini PC (`192.168.1.20`, Debian 13, Docker 29.9)

- **Estructura:** `~/cyberarena/repo` (clon de GitHub) y `~/cyberarena/stack` (`.env`, `secrets/`,
  `lab-flags/`, `backups/` y el enlace a `cyberarena.sh`). Proyecto `cyberarena-prod` con sus redes
  propias (`cyberarena-lan-net`, más `backend` y `labs-control`, internas). No se tocó ningún otro stack
  ni volumen del servidor.
- **Primer intento con Caddy** (HTTPS con CA interna). El usuario lo descartó por ser solo para la LAN.
  Se cambió a la web publicada en `WEB_PORT` (3080) por HTTP (commit `cbe2f67`), con las cabeceras de
  seguridad en Next. Se borraron el contenedor, los volúmenes y la red de Caddy de ese intento.
- **Permisos en Linux** (commit `314bc76`). Los secretos de compose se montan con los permisos del host:
  la api (uid 10001) no podía leer ficheros 600, y el runner no podía atravesar `lab-flags/` en 700.
  Ahora los secretos son 644 dentro de una carpeta 700, y las flags 755/644. `init`/`update` lo aplican
  y `preflight` lo comprueba.
- **Postgres** (commit `40ccaa6`). El mapeo `127.0.0.1:5433` nunca se publicaba: Docker no publica puertos
  de contenedores que solo están en redes internas. Se eliminó ese mapeo y la documentación dice ahora
  que Postgres no publica ninguno (se opera con `docker exec`). El `update` posterior recreó Postgres
  sin perder datos: 2 usuarios, 6 `QuestionSolved` y 6 `XpEvent`, antes y después.
- **Puertos en el host:** solo `0.0.0.0:3080` (web). La api (3001), el runner (4100) y Postgres (5432)
  quedan sin publicar. Los labs, en `192.168.1.20:<puerto>` solo mientras están encendidos.
- **Smoke desde el PC** (`smoke-prod.mjs --base http://192.168.1.20:3080 --env-file … --admin-password-file …`):
  - salud: `db up`, `runner up` y barrido al día;
  - cabeceras de seguridad;
  - catálogo de 4 paths y 59 rooms, con el EN realmente en inglés;
  - recorrido de 118 páginas;
  - login de admin y sus vistas;
  - labs con `publicHost: 192.168.1.20`.
  Todo en verde, y otra vez tras el `update`.
- **Labs desde la LAN:**
  - Prueba con web-recon-1, idor-chain y xss-reflejado: arrancados por la API con un usuario de prueba
    (`flags-*@cyberarena.test`), alcanzados desde el PC en `192.168.1.20:<puerto>` y con las flags
    enviadas por la API.
  - Resultado: **6/6 aceptadas**.
  - El room muestra los comandos con `192.168.1.20` en vez de `127.0.0.1`.
  - Al terminar no quedaba ningún lab encendido.
- **Clon:** `git -C ~/cyberarena/repo status` sigue limpio (0 cambios) tras `init`, `up` y `update`.
  `update` hace `git pull --ff-only`, regenera las flags, rebuild, up y seed.
- **Gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.
