# ADR-009 — Bootstrap del admin inicial al arrancar (no al registrarse)

- **Estado:** aceptada (2026-11-01, enmienda de la fase 001 a petición del dueño)
- **Contexto:** la fase 001 otorgaba ADMIN al primer usuario registrado
  (`databaseHooks.user.create.before` con `count === 0`). Vulnerabilidad real: en un
  despliegue recién levantado y expuesto, cualquier visitante que se registre primero
  se convierte en ADMIN (además de carrera si dos registros coinciden).
- **Decisión:**
  1. **El hook primer-usuario-ADMIN se ELIMINA**: registrarse nunca otorga ADMIN
     (todos los registros nacen STUDENT; los cambios de rol solo vía endpoint admin).
  2. **Bootstrap al arrancar**: `AdminBootstrapService` (`onModuleInit` de la API) crea
     el admin inicial SOLO si la tabla `User` está vacía, usando
     `BOOTSTRAP_ADMIN_EMAIL` (default `admin@cyberarena.local`) y
     `BOOTSTRAP_ADMIN_PASSWORD` (si falta, se genera aleatoria de 20 caracteres y se
     registra UNA vez en el log del arranque, con aviso de cambiarla). La creación se
     hace vía `auth.api.signUpEmail` (hash scrypt oficial de better-auth) + update a
     `role=ADMIN, emailVerified=true`.
  3. **Anti-race**: la unicidad de `email` hace fallar el segundo intento de arranques
     concurrentes; el error de duplicado se detecta y se ignora (idempotente).
  4. **Verificación en cada arranque**: tras el bootstrap se comprueba que exista al
     menos un ADMIN; si hay usuarios pero ningún admin, se registra un ERROR con las
     instrucciones de recuperación (no se auto-crea nada más).
- **Alternativas descartadas:** mantener el hook (vulnerabilidad expuesta); bootstrap
  en el seed (no se ejecuta si se olvida correrlo; el arranque de la API es el único
  evento garantizado); credenciales fijas hardcodeadas (jamás).
- **Consecuencias:** el registro abierto deja de ser vector de escalada; el único
  secreto nuevo vive en `.env` (documentado en runbook). La contraseña autogenerada
  aparece en el log del primer arranque (aceptable para sistema personal; en F8 se
  exige `BOOTSTRAP_ADMIN_PASSWORD` en prod y no se loggea).
