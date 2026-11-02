# Tasks 014 — Publicación open source

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

- [x] T001 spec + tasks 014; ROADMAP.
- [x] T002 Auditoría de credenciales (árbol + historial) con registro. Arreglos:
  - retornos de carro literales en `infra/stacks/prod/secrets/README.md`;
  - contraseña generada del admin inicial con `node:crypto` en lugar de `Math.random`.
- [x] T003 Arranque local desde un clon limpio:
  - plantillas de entorno completas y coherentes;
  - la api carga también el `.env` de la raíz (`pnpm dev`);
  - el stack de dev compila dependencias, migra y hace el seed al arrancar;
  - verificado en un clon nuevo.
- [x] T004 README en inglés (open source) con captura, `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md` y la descripción del proyecto.
- [x] T005 Cierre: gate, registro, 012 T901 (primer run de GitHub Actions) y ROADMAP.

## Registro

### 2026-11-02 — T002, auditoría de credenciales

- **Ficheros:** ningún `.env`, `secrets/*`, `lab-flags/`, clave (`.pem`, `.key`) ni certificado de Caddy se
  ha añadido nunca. Revisado con `git log --all --diff-filter=A --name-only` en los 159 commits.
- **Patrones** en `HEAD` y en todo el historial (`git log --all -p`):
  - buscados: claves privadas PEM, `AKIA…`, `ghp_`/`github_pat_`, `xox?-`, `sk-`/`sk-ant-`, `AIza…`, `glpat-` y `SG.`;
  - único resultado: `AKIAIOSFODNN7EXAMPLE` en `labs/ssrf-basico/site/app.py`, la clave de ejemplo oficial de la documentación de AWS, puesta a propósito como botín del lab.
- **Valores reales:** los 6 secretos locales (`.env` de la raíz y de los stacks, `infra/stacks/prod/secrets/*`) se buscaron literalmente en el historial, sin mostrarlos.
  - Única coincidencia: `dev-only-change-me`, el valor de ejemplo de `infra/stacks/dev/.env.example`, que el `.env` local reutiliza; no es un secreto.
  - Los secretos de producción y del mini PC no aparecen en ningún sitio.
- **Contenido deliberado, no son credenciales:**
  - respuestas (`packages/content/private/answers`);
  - flags de los labs (`flags.env.example`);
  - contraseñas débiles de las apps vulnerables de `labs/`.
  Es la decisión del §4 de la spec.
- **Datos personales:**
  - el email del autor en los commits;
  - la IP privada `192.168.1.20` en tests y docs de la fase 013 (RFC 1918, sin riesgo);
  - la URL del repo en `infra/stacks/lan/README.md`.
- **Arreglos:**
  - `infra/stacks/prod/secrets/README.md` llevaba retornos de carro literales (una edición antigua convirtió el texto `\r` en el carácter) y git lo trataba como binario: restaurado y pasado a LF;
  - la contraseña generada del admin inicial usaba `Math.random`: ahora usa `crypto.randomInt`, con test.
  - `Math.random` solo queda en la mascota Byte y en los E2E.

### 2026-11-02 — T003, arranque desde un clon limpio

**Problemas encontrados** (el "revalidado" de 000 T901 se hizo sobre una copia de trabajo ya compilada):

- **Variante A (todo en Docker):**
  - en un clon limpio no existen `packages/*/dist`, el cliente Prisma ni el catálogo, así que el api no compilaba;
  - el api arrancaba antes de migrar: el bootstrap del admin fallaba (no hay tablas) y no se reintenta hasta el siguiente arranque;
  - `API_PORT` cambiaba también el puerto interno, lo que rompía la web y el healthcheck.
- **Variante B (`pnpm dev`):**
  - el api solo leía `apps/api/.env` (`ConfigModule` con el cwd del paquete), nunca el `.env` de la raíz;
  - `DATABASE_URL` del ejemplo de la raíz usaba una contraseña distinta de la del stack de dev;
  - el SMTP de mailpit no estaba publicado.
- **Plantillas:** faltaban variables que sí usan el código y los compose:
  - `LAB_IDLE_TIMEOUT_MIN`, `LAB_SWEEP_SECONDS`, `LAB_BIND_ADDRESS` y `LAB_PUBLIC_HOST`;
  - `LAB_UNLEASED_GRACE_SECONDS`, `LAB_LOOP_SECONDS` y `TRUST_PROXY`.

**Arreglos:**

- El api del stack de dev compila sus dependencias (`turbo run build --filter=@repo/api^...`), migra y hace el seed antes de `nest start`.
- La web espera a que el api esté sano.
- `start_period` pasa a 600 s.
- `API_PORT` interno fijo en 3001.
- SMTP de mailpit en `127.0.0.1:1025`.
- `ConfigModule` lee `.env` y `../../.env`; las variables ya definidas siempre ganan.
- Plantillas completas y coherentes.
- Runbook alineado con todo lo anterior.

**Verificación** en un clon nuevo del HEAD con los cambios aplicados:

- Proyecto aparte (`-p ca-oss`) con otros puertos, sin tocar el stack de dev del usuario.
- `core.autocrlf=true`, como un usuario de Windows.
- **Variante A:**
  - `up -d` sobre un store de pnpm vacío tardó 3 min 30 s. Compiló `shared`/`content`/`database`, aplicó 11 migraciones, hizo el seed (59 rooms, 491 preguntas), creó el admin con contraseña generada y la web arrancó al quedar sano el api.
  - El comando del README para leer la contraseña funcionó, después de añadirle el `--env-file` que faltaba: lo detectó la propia prueba.
  - Smoke `smoke-prod.mjs` contra la web:
    - salud con la BD `up`;
    - cabeceras;
    - `/es`, `/en`, paths, hacktivities y status;
    - catálogo de 4 paths y 59 rooms, con el EN en inglés;
    - login de admin y su rol;
    - endpoint de certificados.
  - Solo fallan los 3 checks que exigen el runner de labs, apagado por defecto en dev.
- **Variante B:**
  - `pnpm install` 1 min 19 s; `pnpm build` en verde (6/6);
  - `db:migrate`/`db:seed` con el `.env` de la raíz;
  - `pnpm dev`: el api conecta a la BD leyendo el `.env` de la raíz, la web sirve `/es` y reenvía `/api`;
  - mismo smoke con login de admin, en verde salvo los 3 checks de labs.
  - Para que `next dev` arrancara hubo que parar la web de la variante A: comparten `apps/web/.next/dev` (anotado en el runbook).
- **Limpieza:** contenedores, red y volúmenes `ca-oss_*` borrados (sin `down -v`, para no tocar `cyberarena-lab-assets`), procesos de prueba terminados y clon borrado.
- **Gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.

### 2026-11-02 — T004, documentación open source

- **`README.md` en inglés**, con la captura `docs/assets/image.jpg`. Secciones:
  - funcionalidades;
  - contenido (tabla de paths);
  - arquitectura y stack;
  - arranque local paso a paso: opción A (Docker) y opción B (`pnpm dev`), ambas verificadas en T003;
  - labs;
  - despliegue;
  - desarrollo;
  - estructura;
  - documentación;
  - seguridad;
  - contribución;
  - licencia, con un aviso de no afiliación con TryHackMe.
- **`LICENSE`** MIT; `"license": "MIT"` en `package.json`.
- **`CONTRIBUTING.md`:** flujo SDD, Conventional Commits, el gate, idiomas, contenido y reglas de los labs.
- **`SECURITY.md`:** reporte privado por GitHub. El alcance excluye las vulnerabilidades intencionadas y las respuestas del repo, y hay recomendaciones de despliegue.
- **Descripción del proyecto** sin "personal" en `package.json` y en los metadatos de la web (ES/EN).
- Todos los enlaces relativos del README, CONTRIBUTING y SECURITY apuntan a ficheros existentes.
