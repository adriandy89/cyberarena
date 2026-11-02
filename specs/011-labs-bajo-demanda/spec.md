# Spec 011 — Labs bajo demanda

- **Estado:** completada (2026-11-02)
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión, a partir de la petición del usuario: «levantar los labs y apagarlos desde
    el frontend solo cuando un usuario los utiliza, de forma óptima y a prueba de que se queden
    funcionando si nadie los está utilizando, revisión periódica del sistema. Seguridad».
  - 2026-11-02 T003: el limitador propio de better-auth **ya estaba activo** en producción por defecto
    (100 req/10 s; sign-in/sign-up 3/10 s por IP, con la IP del `X-Forwarded-For` de un solo valor que
    pone Caddy); se deja explícito sin cambiar su comportamiento. Confiar redes privadas en better-auth
    sería un error: si el cliente también llega desde una IP privada (Docker Desktop, LAN), todos caen en
    un único cubo. Verificado contra la API de dev: con `X-Forwarded-For` A, la 31.ª respuesta en un
    minuto da 429 y la IP B sigue pasando; health no se limita.
  - 2026-11-02 T005: los 39 labs pasan el lint (`restart: "no"`, 256m/0.5 CPU/128 pids — 256 pids en
    nmap-playground —, `cap_drop: ALL` también en container-escape, privesc, linux-explore e
    incident-response, bloque `x-cyberarena`). Smoke real de los 39 (up, GET 200 o `exec`, down): 39/39.
    **privesc-linux-1 estaba roto desde su creación**: `no-new-privileges` bloqueaba SUID y sudo, y el
    `chmod u+s /usr/bin/find` caía sobre el enlace de busybox, que baja al uid real. Ahora instala GNU
    findutils/bash/coreutils, el SUID va al `find` real y el lab declara la excepción `security-opt`;
    verificados los 4 vectores como `student` (SUID find, `find -exec bash -p`, `sudo vim`, cron).
    En Docker Desktop el port-forward acepta TCP antes de que la app escuche: «listo» se comprueba con
    una petición HTTP, no con el puerto (los labs Python tardan ~2 s).
  - 2026-11-02 T007, verificado con el runner real en contenedor (dev, `--profile labs`, gracia 60 s):
    `up --wait` de sqli-basico → HTTP 200 desde el host, montaje del volumen de assets `RW:false`,
    `restart=no`, 256 MB/128 pids/0,5 CPU; sin renovar, se apaga al vencer el plazo; un lab levantado a
    mano se adopta y se apaga a los 60 s; SIGTERM al runner apaga todos los labs; al arrancar adopta lo
    que encuentra. La imagen no contiene ningún `.env`.
  - 2026-11-02 T009–T010, verificado en vivo (API de dev + runner real, inactividad 1 min, barrido 10 s):
    `GET /api/labs` público; arrancar → `running` y HTTP 200 en 127.0.0.1:18081; un segundo usuario
    comparte el lab (`users=2`); segundo lab sin `switch` → 409 `LAB_OTHER_ACTIVE`; ampliar fuera de la
    ventana → `LAB_CANNOT_EXTEND`; al detener uno, el lab sigue para el otro; sin latidos, el reaper
    caduca la reserva (`EXPIRE_IDLE`) y apaga el lab; `/api/health` informa del barrido. El bloqueo
    consultivo se comprobó contra Postgres real (se mantiene en la transacción y se libera al terminar).
  - 2026-11-02 T011–T014 y cierre. Web probada en Chromium (invitado, iniciar, en marcha, pestaña del
    lab extra, detener, `/en`, 390 px, panel admin y `/status`). E2E completo 28/28 contra el dev stack
    (incluido `labs.spec` con el reaper a 1 min). Smoke de los 39 labs a través del runner: 39/39. Con
    la API parada, el runner apagó el lab él solo al vencer su plazo (~5 min: el plazo inicial es la
    gracia de 300 s, mayor que el `ttl` de renovación de 180 s).
  - **Hallazgos de entorno** (no son bugs de la app): el `next dev` en contenedor sobre un bind mount de
    Windows no detecta ficheros nuevos hasta reiniciar el contenedor; `next dev` de Next 16 no hidrata si
    se abre por `127.0.0.1` en vez de `localhost` (bloquea recursos de dev de otro origen); el harness
    E2E ahora ata la cookie de sesión al host de `E2E_BASE_URL`.

## 1. Propósito

Hoy el `LabPanel` solo muestra comandos `docker compose` para copiar: el estudiante levanta el lab a
mano y nadie lo apaga. En la API no hay ni cliente Docker, ni scheduler, ni modelo de sesiones. Además:

- todos los labs llevan `restart: unless-stopped`, así que reviven al reiniciar Docker;
- ninguno tiene límites de CPU, memoria ni procesos;
- cuatro no tienen `cap_drop: ALL`.

Esta fase hace que un lab **se arranque desde la web cuando alguien lo necesita y se apague solo
cuando nadie lo usa**, con varias capas que garantizan el apagado aunque falle una de ellas, y endurece
los labs para que puedan correr de forma desatendida.

### Decisiones del usuario (2026-11-02)

| Tema | Decisión |
|---|---|
| Modelo | **Una instancia por lab, compartida** entre quienes la usan (contador de reservas). Se accede desde la máquina del servidor (`127.0.0.1`), como hasta ahora |
| Inactividad | Se apaga a los **10 min sin latido** |
| Duración | **2 h por sesión**, ampliable hasta **4 h** |
| Límites | **1 lab activo por usuario**; **3 labs a la vez** en el servidor |
| Quién | **Cualquier usuario con sesión**; los invitados ven un CTA de login |

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante con sesión*, en un room con lab pulso «Iniciar lab», veo cómo arranca y,
  cuando está listo, el enlace (labs web) o el comando `docker exec` (labs de terminal).
- **US2 (P1)** — Como *estudiante*, mientras tengo la página del room abierta (aunque esté en otra
  pestaña atacando desde la terminal) el lab sigue vivo; veo a qué hora se apagará, puedo ampliarlo y
  detenerlo.
- **US3 (P1)** — Como *operador*, un lab que nadie usa se apaga solo, aunque el usuario cierre el
  navegador, la API se reinicie o la BD se caiga.
- **US4 (P1)** — Como *operador*, el sistema se revisa periódicamente: barrido de reservas cada minuto,
  estado visible en `/api/health`, en `/status` y en el panel de admin, con anomalías en el log.
- **US5 (P2)** — Como *admin*, veo los labs activos, quién los usa y los últimos eventos, y puedo
  detener uno o todos.
- **US6 (P2)** — Como *autor*, un lint rechaza en el build cualquier compose de lab inseguro.

## 3. Requisitos

1. **lab-runner**: servicio aparte, el único con acceso a `docker.sock`. Solo es alcanzable desde la API
   por una red interna, con token. Solo arranca labs de un manifiesto generado en el build a partir de
   `labs/*/compose.yaml`; nunca recibe rutas ni contenido de compose. No ejecuta shell.
2. **Reservas** (`LabLease`): una por usuario (clave primaria `userId`). Una instancia de lab sigue viva
   mientras tenga al menos una reserva vigente. Las operaciones que cambian la capacidad van en una
   transacción con bloqueo consultivo de Postgres.
3. **Latido**: la web envía uno cada 60 s mientras la página del room está abierta (también oculta) y en
   `visibilitychange`/`pageshow`/`focus`; enviar una respuesta del room también cuenta como actividad.
   Nunca se apaga al cerrar la página: decide el reaper.
4. **Reaper** (API, cada 60 s): caduca reservas sin latido > 10 min o con más de su duración máxima,
   apaga los labs que se quedan sin reservas y renueva en el runner el plazo de los que siguen en uso.
5. **Interruptor del runner**: cada lab en marcha tiene un plazo; el runner apaga los que vencen sin
   renovar. Los proyectos `lab-*` que encuentra sin plazo (arrancados a mano o tras reiniciarse) se
   adoptan con 5 min de gracia. Un watchdog reinicia el runner si su bucle se para.
6. **Revisión del sistema**: `/api/health` informa del subsistema de labs (`enabled`, runner,
   labs en marcha, último barrido) y se degrada si el barrido lleva más de 3 min sin ejecutarse.
7. **Seguridad de los labs** (lint en el build): puertos solo en `127.0.0.1` y únicos; sin `privileged`,
   red/pid/ipc del host ni dispositivos; volúmenes solo relativos de solo lectura o con nombre (nunca
   `docker.sock` ni rutas absolutas); `cap_drop: ALL` + `cap_add` de una lista blanca; `no-new-privileges`;
   límites de memoria, CPU y procesos; `restart: "no"`; imágenes con tag fijo. Toda excepción lleva
   motivo escrito en el bloque `x-cyberarena` del compose.
8. **Interruptor general** `LABS_ENABLED` (por defecto `false`): sin él, el `LabPanel` muestra los
   comandos manuales de siempre.
9. **Rate limiting real**: la API ve la IP del cliente (no la del proxy) y aplica límites por ruta.
10. Textos ES/EN y reacciones de Byte (lab listo, caducado, error).

## 4. Criterios de éxito

- [x] Un lab arrancado desde la web se apaga solo a los 10 min de cerrar la pestaña (TTL corto en test:
      prueba en vivo de la API y E2E `labs.spec` con inactividad de 1 min).
- [x] Con la API parada, el runner apaga los labs al vencer su plazo; al reiniciar el runner, barre.
- [x] Un lab levantado a mano se adopta y se apaga a los 5 min si nadie lo reserva (probado con gracia
      de 60 s en dev).
- [x] Dos usuarios comparten un lab; al detenerlo uno, el otro sigue. 1 lab por usuario y 3 globales
      (compartir y 1 por usuario en vivo y en E2E; la capacidad global en tests unitarios).
- [x] El lint rechaza un compose inseguro; los 39 labs lo pasan.
- [x] E2E `labs.spec` en verde (con el runner real del dev stack; también vale con el simulado); smoke de
      labs reales 39/39.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.

## 5. Fuera de alcance (T9xx)

Multi-instancia por usuario, acceso remoto a los labs (proxy/VPN), daemon rootless dedicado, detectar
actividad por el tráfico del lab, «reset» de un lab compartido, bloqueo de salida a internet con imágenes
precocinadas, rotar las flags y sacarlas de git, cola de espera por capacidad, healthchecks por lab y
temporizador de respaldo a nivel host.

## 6. Supuestos

- Docker Engine ≥ 26 y Compose ≥ 2.24.4 (verificado en el host de desarrollo: Engine 29.9.2, Compose 5.6.1).
- Las flags siguen siendo estáticas por lab (la tabla `Answer` no tiene `userId`).
