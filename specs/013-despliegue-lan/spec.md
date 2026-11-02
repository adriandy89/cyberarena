# Spec 013 — Despliegue en la LAN (mini PC)

- **Estado:** en curso
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión. Petición del usuario: desplegar en su mini PC (`192.168.1.20`, Debian 13,
    Docker 29.9) con su propia red Docker, accesible desde el navegador en la LAN; el repo clonado en una
    carpeta aparte y la configuración del servidor fuera del clon, para que `git pull` nunca choque.
    Decisiones: labs expuestos en la IP de la LAN mientras están encendidos; HTTPS con la CA interna de
    Caddy aceptando el aviso del navegador (sin instalar la CA).

## 1. Propósito

La fase 012 verificó producción en `https://localhost`. Para usar la plataforma desde otros equipos de la
LAN hace falta:

- servir la web en la IP del servidor;
- publicar los puertos de los labs en esa IP (hoy solo en `127.0.0.1`, inalcanzables desde fuera);
- que los comandos de las tareas (`curl http://127.0.0.1:18081/...`) apunten a esa IP;
- un kit de despliegue que viva fuera del clon y se actualice con `git pull`.

## 2. Requisitos

1. **lab-runner**: `LAB_BIND_ADDRESS` (IP donde se publican los puertos; por defecto `127.0.0.1`) y
   `LAB_PUBLIC_HOST` (host que ven los estudiantes). Los composes de los labs y su lint NO cambian: el
   runner reescribe los puertos en el override que ya genera.
2. **api/web**: `LAB_PUBLIC_HOST` llega a la web (`GET /api/labs`) y el room sustituye `127.0.0.1:<puerto
   de lab>` por ese host en teoría, enunciados, pistas y opciones; el panel de lab muestra ese host.
3. **Kit LAN** (`infra/stacks/lan/`): overlay de compose (Caddy dentro del mismo proyecto, red propia,
   contexto de build desde `REPO_DIR`), plantilla de `.env` y `cyberarena.sh`
   (`init|preflight|up|down|destroy|ps|logs|seed|update|backup|labs`). Se usa desde una carpeta de stack
   **fuera** del clon; el clon no se modifica.
4. **Servidor**: `~/cyberarena/repo` (clon de GitHub) y `~/cyberarena/stack` (`.env`, `secrets/`,
   `lab-flags/`, `backups/`, enlace a `cyberarena.sh`). No toca otros stacks del servidor ni sus puertos.

## 3. Criterios de éxito

- [ ] Desde el PC del usuario, `https://192.168.1.20` sirve la plataforma (smoke en verde).
- [ ] Un lab arrancado desde la web es accesible en `http://192.168.1.20:<puerto>` y su flag se acepta.
- [ ] `git -C ~/cyberarena/repo status` limpio tras desplegar; `./cyberarena.sh update` hace `pull` + rebuild.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` en verde.

## 4. Seguridad

Con `LAB_BIND_ADDRESS` en la IP de la LAN, cualquier equipo de la red alcanza los labs (apps vulnerables a
propósito) mientras están encendidos. Por eso es opcional, por defecto desactivado, y los labs siguen
apagándose solos (fase 011). La API, Postgres (`127.0.0.1:5433`) y el runner siguen sin exponerse; solo
Caddy publica 80/443.
