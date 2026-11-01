# Lab template

Cada room práctico tiene su **propio stack de Docker Compose aislado** en `labs/<room-slug>/`.
Este template es el patrón obligatorio (constitución §1.4 y ADR-006).

## Reglas

1. **Red aislada**: una red `lab-<room-slug>` propia; JAMÁS conectar a las redes del stack
   de la aplicación (`cyberarena-dev_frontend/backend` ni producción).
2. **Puertos**: publicar como máximo los necesarios y siempre en `127.0.0.1:` (loopback).
3. **Flags**: los valores reales viven en `flags.env` (no commiteado; solo su `.env.example`
   con placeholders) y se siembran hasheados en la BD vía el pipeline de seed (fase 002).
   El MDX del room nunca contiene el valor.
4. **Efímero**: `down -v` siempre al terminar; sin volúmenes persistentes de datos.
5. **Hardening**: `cap_drop: ALL`, `no-new-privileges`, imágenes específicas con tag.
6. README por lab: objetivo, máquinas, puertos, pista de despliegue y prerrequisitos.

## Estructura esperada por room

```
labs/<room-slug>/
├── compose.yaml        # servicios vulnerables, red aislada, puerto loopback
├── flags.env.example   # FLAG_1=... (placeholder), FLAG_2=...
└── README.md           # objetivo y contexto del lab
```
