# Tasks 014 — Publicación open source

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

- [x] T001 spec + tasks 014; ROADMAP.
- [ ] T002 Auditoría de credenciales (árbol + historial) con registro. Arreglos:
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

_(se rellena durante la fase)_
