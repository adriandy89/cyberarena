# Spec 012 — Despliegue Docker completo y verificado

- **Estado:** en curso
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión. Absorbe la T3 (stack prod verificado) y la T4 (limpieza) de la spec 106 y
    añade el lab-runner de la fase 011. Petición del usuario: «hacer lo que falta para terminar el
    proyecto y probar un despliegue en Docker completo».

## 1. Propósito

El stack de producción (`infra/stacks/proxy` + `infra/stacks/prod`) nunca se ha levantado entero. La
auditoría previa encontró problemas que lo impedirían o lo dejarían frágil:

- el entrypoint descarga pnpm al arrancar (necesita red) y un secreto con `\r` rompería la contraseña;
- `.dockerignore` deja entrar `.pnpm-store/`, `backups/` y los secretos en el contexto de build;
- el rewrite `/api` de la web se hornea con `localhost:3001` al compilar;
- Caddy no tiene healthcheck y el comentario del compose del proxy tiene mal el `--project-directory`;
- los scripts de backup/restore apuntan por defecto a la BD de **dev**;
- el seed del runbook monta `dist` en una ruta que el código no lee;
- el harness E2E no funciona contra HTTPS (cookie `__Secure-`, certificado interno).

(El rate limit tras el proxy y Postgres publicado en todas las interfaces ya se corrigieron en la 011.)

## 2. Historias de usuario

- **US1 (P1)** — Como *operador*, despliego proxy + prod + lab-runner con los comandos del runbook y todo
  queda sano (healthchecks verdes) sin pasos manuales ocultos.
- **US2 (P1)** — Como *operador*, compruebo el despliegue con un smoke (TLS, health, catálogo ES/EN, login,
  PDF, hacktivities, labs) y con la suite E2E sobre HTTPS.
- **US3 (P1)** — Como *operador*, los labs bajo demanda funcionan en prod igual que en dev (arranque desde
  la web, reaper, plazos del runner, adopción).
- **US4 (P2)** — Como *operador*, hago backup y lo restauro en una BD aparte sin tocar la de producción.
- **US5 (P2)** — Al terminar, dejo el equipo limpio de lo que creó la prueba, sin tocar otros proyectos.

## 3. Requisitos

1. El arranque de la API no necesita red (sin corepack/pnpm en runtime) y tolera `\r\n` en los secretos.
2. Ningún secreto, backup ni store de pnpm entra en el contexto de build de una imagen.
3. Los scripts destructivos (restore) exigen el contenedor y la BD destino explícitos.
4. Scripts de operación: `seed-prod.sh` (seed dentro del contenedor de la API, la contraseña nunca en la
   línea de comandos) y `smoke-prod.sh`.
5. El E2E admite `E2E_BASE_URL=https://localhost` (cookie segura, certificado de Caddy).
6. Registro con fechas y evidencias de cada paso del despliegue.
7. Limpieza acotada a este proyecto (decisión del usuario 2026-11-02): nada de prunes globales.

## 4. Criterios de éxito

- [ ] `proxy up` + `prod up --build` con todos los servicios healthy.
- [ ] Seed doble estable; smoke en verde; E2E completo sobre HTTPS en verde.
- [ ] Labs en prod: arranque desde la UI, flag resuelta, reaper, plazo del runner con la API parada,
      adopción; smoke de los 39 labs.
- [ ] Backup + restore en BD scratch con conteos iguales.
- [ ] Limpieza hecha con `docker system df` antes/después en el registro.

## 5. Fuera de alcance

Dominio real con ACME, registro de imágenes, alta disponibilidad, monitorización externa.
