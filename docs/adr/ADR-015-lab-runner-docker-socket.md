# ADR-015 — Labs bajo demanda: lab-runner con acceso a Docker

- **Estado:** aceptada (2026-11-02, fase 011)
- **Contexto:** la fase 007 dejó fuera de alcance el «ciclo de vida gestionado desde la API (docker
  socket)»: el estudiante levantaba y apagaba cada lab a mano y nada impedía que se quedara encendido.
  La fase 011 exige arrancar los labs desde la web y apagarlos solos cuando nadie los usa. Para eso algún
  proceso tiene que hablar con el daemon Docker, y el acceso a `docker.sock` equivale a root en el host:
  quien puede crear contenedores puede montarse `/` o pedir `--privileged`.
- **Opciones consideradas:**
  1. **La API con `docker.sock`.** Descartada: pone root detrás del proceso expuesto a internet.
  2. **Socket-proxy delante del daemon** (filtrar endpoints de la API de Docker). Descartada como
     control principal: `docker compose up` necesita `POST /containers/create`, y ese endpoint ya
     acepta `Privileged` y binds arbitrarios, así que el filtro no impide lo peligroso.
  3. **Servicio aparte (`lab-runner`) con superficie mínima.** Elegida.
  4. **Daemon rootless dedicado a los labs.** Es la mejora real de aislamiento, pero cambia la
     instalación del host; queda como T901 de la fase 011.
- **Decisión:**
  1. Un servicio `lab-runner` es el **único** con `docker.sock`. Vive solo en la red interna
     `labs-control` (compartida con la API), no publica puertos y exige un token Bearer leído de un
     secreto Docker (comparación en tiempo constante).
  2. **No acepta rutas, YAML ni argumentos libres**: solo un slug, validado por regex y contra un
     **manifiesto generado en el build** a partir de `labs/*/compose.yaml`. Los labs van **dentro de
     la imagen** del runner, así que no se pueden alterar en caliente.
  3. Un **lint** en el build rechaza composes inseguros (puertos fuera de `127.0.0.1`, `privileged`,
     red/pid/ipc del host, dispositivos, `docker.sock` o rutas absolutas, sin `cap_drop: ALL`, sin
     `no-new-privileges`, sin límites, `restart` distinto de `"no"`, imágenes sin tag). Las excepciones
     se declaran con motivo en el bloque `x-cyberarena` de cada compose.
  4. Ejecuta `docker compose` con `execFile` (sin shell), con timeouts, mutex por lab y un máximo de
     operaciones y de labs simultáneos.
  5. El contenedor del runner es `read_only` con tmpfs, `cap_drop: ALL`, `no-new-privileges` y con
     límites de recursos, sin dependencias npm de runtime. **Corre como root**: con el socket montado,
     un usuario sin privilegios en el grupo `docker` es igual de poderoso, así que separarlo sería
     teatro. Es una excepción documentada a la constitución §1.3.
  6. **Apagado a prueba de fallos** en tres capas: reaper de la API (reservas con latido), plazos
     propios del runner que solo la API renueva (si la API o la BD caen, los labs mueren igualmente) y
     `restart: "no"` en los labs con barrido al arrancar el runner. Un watchdog reinicia el runner si
     su bucle se bloquea.
  7. Postgres de producción se publica solo en `127.0.0.1` para que ningún lab lo alcance por la
     gateway de su red (constitución §1.4).
- **Consecuencias:**
  - Un compromiso del runner equivale a root en el host: riesgo residual aceptado, acotado por la red
    interna, el token y la superficie mínima. T901 (rootless) lo reduce.
  - Los labs de terminal (`access: exec`) siguen pidiendo Docker en el host para entrar con
    `docker exec`; quien tiene eso ya puede leer las flags con `docker inspect`. Coherente con el modelo
    local de la plataforma.
  - Cambiar un lab exige reconstruir la imagen del runner (aceptable: los labs cambian con el código).
  - Requiere Docker Engine ≥ 26 y Compose ≥ 2.24.4 (`volume.subpath`, `!override`); el runner lo
    comprueba en `/healthz`.
