# Tasks 014 — Publicación open source

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

- [x] T001 spec + tasks 014; ROADMAP.
- [x] T002 Auditoría de credenciales (árbol + historial) con registro. Arreglos:
  - retornos de carro literales en `infra/stacks/prod/secrets/README.md`;
  - contraseña generada del admin inicial con `node:crypto` en lugar de `Math.random`.
- [ ] T003 Arranque local desde un clon limpio:
  - plantillas de entorno completas y coherentes;
  - la api carga también el `.env` de la raíz (`pnpm dev`);
  - el stack de dev compila dependencias, migra y hace el seed al arrancar;
  - verificado en un clon nuevo.
- [ ] T004 README en inglés (open source) con captura, `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md` y la descripción del proyecto.
- [ ] T005 Cierre: gate, registro, 012 T901 (primer run de GitHub Actions) y ROADMAP.

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
