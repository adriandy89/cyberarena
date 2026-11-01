# Spec 007 — Labs (laboratorios Docker por room)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada y E2E verificado con lab real. Notas: (1) El
    comando `down` también interpola `flags.env` (guards `:?`) → los comandos de
    destrucción llevan `--env-file` (LabPanel, README y MDX actualizados). (2) El lab
    usa nginx:1.29-alpine con sustitución de placeholders por `sed` (envsubst no está
    en la imagen alpine) — cero builds de imágenes. (3) Añadir el room nuevo bajó el %
    de CS101 del admin de 100→67 y lo restauró a 100 al resolverlo (comportamiento
    correcto documentado en §6).

## 1. Propósito

Labs prácticos reales: stacks Docker aislados por room (patrón `labs/_template`), con
flags inyectadas por variables de entorno, integrados en el room player con panel de
despliegue, y verificación de flags a través del flujo normal de respuestas.

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante*, en un room con lab veo un panel con el comando
  exacto para levantarlo (`docker compose ... up -d`), la URL del lab y el comando de
  limpieza (`down -v`), con botones de copiar.
- **US2 (P1)** — Como *estudiante*, levanto el lab en mi máquina, hago recon con curl y
  encuentro las flags del entorno; las envío como cualquier respuesta.
- **US3 (P1)** — Como *autor*, creo labs declarativos (compose + plantillas de sitio +
  `flags.env`) sin construir imágenes custom.
- **US4 (P2)** — Como *sistema*, `labUrl` viaja por el pipeline (frontmatter → builder →
  BD → API → web) y el catálogo/hacktivities marca los rooms con lab.

## 3. Requisitos funcionales

1. **Lab `web-recon-1`** (patrón declarativo, sin build): nginx alpine + plantillas del
   sitio montadas read-only; el entrypoint sustituye placeholders `__FLAG_n__` con los
   valores de `flags.env` vía `sed` antes de arrancar. Contenido: `index.html` de
   bienvenida, `robots.txt` que desvela `/secreto/`, página secreta con `FLAG_1` y
   cabecera de respuesta `X-Secret-Flag: FLAG_2`. Puerto `127.0.0.1:18080:80`, red
   interna aislada, `cap_drop: ALL` + caps mínimas de nginx, `no-new-privileges`.
2. **Room `recon-web-basico`** (módulo start-your-cyber-journey, CS101): 2 tasks —
   despliegue + robots/página secreta, y recon de cabeceras — con 3 preguntas:
   ruta prohibida por robots (text), `FLAG_1` (flag), `FLAG_2` (flag).
   Frontmatter: `lab: web-recon-1`, `labUrl: http://127.0.0.1:18080`.
3. **Pipeline**: `labUrl` opcional en frontmatter (validación: `labUrl` ⇒ `lab`);
   `Room.labUrl` en BD (migración `0007_lab_url`); incluido en catálogo y hacktivities.
4. **Web**: `LabPanel` en la página del room (comandos up/down con copiar, URL,
   aviso de entorno educativo local).
5. **Coherencia flags↔respuestas**: los valores de `flags.env` del lab deben coincidir
   con `private/answers` (revisión humana; el builder no puede ver el env del lab).
   Convención documentada en la guía.

## 4. Criterios de éxito (verificables)

- [x] `docker compose -f labs/web-recon-1/compose.yaml --env-file labs/web-recon-1/flags.env up -d`
      deja el lab en 127.0.0.1:18080: `robots.txt` desvela la ruta, `/secreto/` sirve
      `FLAG_1` y `curl -I` expone `X-Secret-Flag: FLAG_2`; `down -v` limpia todo.
- [x] El room `recon-web-basico` aparece en catálogo/hacktivities con badge lab y
      `labUrl`; su página muestra el LabPanel con los comandos.
- [x] E2E con sesión admin: recon real del lab con curl (leer robots → visitar secreto →
      leer header) y enviar las 3 respuestas → room 2/2 completado; cs101 vuelve al
      100% (9/9 preguntas) y reaparece el certificado (130 XP). *(verificado al completo)*
- [x] `pnpm lint && typecheck && test && build` verdes.

## 5. Fuera de alcance

Lifecycle gestionado desde la API (docker socket), AttackBox en navegador (Kasm),
labs con múltiples máquinas, detección de lab levantado desde la web.

## 6. Supuestos

- Las flags del lab viajan SOLO por `flags.env` (gitignored) y `private/answers`
  (hash); las plantillas usan placeholders.
- Añadir contenido a un path completado reduce el % (comportamiento correcto; los
  badges/certificados ya otorgados permanecen como logros históricos).
