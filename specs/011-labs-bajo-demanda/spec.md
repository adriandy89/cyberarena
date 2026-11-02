# Spec 011 — Labs bajo demanda

- **Estado:** en curso
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

- [ ] Un lab arrancado desde la web se apaga solo a los 10 min de cerrar la pestaña (TTL corto en test).
- [ ] Con la API parada, el runner apaga los labs al vencer su plazo; al reiniciar el runner, barre.
- [ ] Un lab levantado a mano se adopta y se apaga a los 5 min si nadie lo reserva.
- [ ] Dos usuarios comparten un lab; al detenerlo uno, el otro sigue. 1 lab por usuario y 3 globales.
- [ ] El lint rechaza un compose inseguro; los 39 labs lo pasan.
- [ ] E2E `labs.spec` en verde con el runner simulado; smoke de labs reales en el dev stack.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.

## 5. Fuera de alcance (T9xx)

Multi-instancia por usuario, acceso remoto a los labs (proxy/VPN), daemon rootless dedicado, detectar
actividad por el tráfico del lab, «reset» de un lab compartido, bloqueo de salida a internet con imágenes
precocinadas, rotar las flags y sacarlas de git, cola de espera por capacidad, healthchecks por lab y
temporizador de respaldo a nivel host.

## 6. Supuestos

- Docker Engine ≥ 26 y Compose ≥ 2.24.4 (verificado en el host de desarrollo: Engine 29.9.2, Compose 5.6.1).
- Las flags siguen siendo estáticas por lab (la tabla `Answer` no tiene `userId`).
