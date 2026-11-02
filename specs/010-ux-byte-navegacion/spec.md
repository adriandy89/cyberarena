# Spec 010 — UX: mascota Byte, animaciones, navegación y orden de contenidos

- **Estado:** completada (2026-11-02)
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión (decisiones del usuario: mascota robot "Byte" estilo visor
    compacto, tono compañero curioso; presencia flotante + inline; reestructuración
    completa del orden de contenidos).
  - 2026-11-02 implementación completada (T001–T027 + T901). Verificación:
    `pnpm lint && typecheck && test && build` en verde (shared 36, content 13, api 66 tests);
    `pnpm test:e2e` 22/22 contra un stack local (web :3006 + api :3011 vía `E2E_BASE_URL`,
    `E2E_NO_SERVER`, `E2E_API_URL`); seed doble estable con los rooms movidos en su nuevo
    padre; capturas a 1440/390 px de home, rutas, ruta, room, dashboard y 404.
    Flujos verificados además con scripts: invitado → login `?next=` → vuelta al room;
    fallo ×3 → pista; acierto con subida de nivel (NEOPHYTE → APPRENTICE) + room completado
    en cola; `?task=N` y flechas ←/→.
  - **Desviaciones conscientes:** `password-attacks` y `mobile` se movieron en T023 (no en
    T022/T024) para que cada commit compile (un módulo/room huérfano rompe el build).
    `hintOpened`/`answerWrongRepeated` bajaron a prioridad 2 y las reacciones de prioridad
    < 3 que no caben se descartan (encolarlas mostraba consejos obsoletos segundos después).
  - **Bugs encontrados y corregidos de paso:** T901 (catálogo EN con otra forma → NaN);
    `/paths` y `/paths/[slug]` no pasaban `?locale=en`; el login usaba el router de
    `next/navigation` (perdía el idioma); el dashboard redirigía a `/{locale}/login` con el
    router i18n (doble prefijo); el certificado se quedaba cargando para invitados; texto
    mezclado ES/EN en el aviso del lab; Chrome ignoraba `scale` en el grupo animado de Byte
    (el espejo ahora es un grupo estático).
  - **Aviso de orden aceptado:** `social-engineering` (easy) va tras `recon-pasivo-osint`
    (medium) a propósito: construye el pretexto con el OSINT del room anterior.
  - **Compromiso conocido:** con `loading.tsx` (streaming) un room/ruta inexistente responde
    HTTP 200 con la UI de 404 (Next añade `noindex`) en vez de un 404 real.
  - **Deuda registrada:** T902 (cuerpos de tareas sin traducir al inglés en los 59 rooms),
    T903 (solapamiento de exfiltración DNS), T904 (Burp introducido tres veces).

## 1. Propósito

El frontend funciona pero se siente plano y desconectado: solo la home tiene cabecera,
no hay menú móvil ni migas, un room no sabe a qué path pertenece ni cuál es el siguiente,
el feedback de respuestas es texto plano (un 401 aparece como "Incorrecta") y no existe
ninguna política de movimiento accesible. Además el orden de contenidos es accidental
(Advanced aparece primero por orden alfabético de ficheros) y la home enumera paths que
no existen.

Esta fase da a CyberArena una identidad (la mascota **Byte**), una shell de navegación
común, animaciones con propósito y accesibles, y un recorrido de contenidos coherente de
novato a experto.

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante*, en cualquier página veo la misma cabecera (rutas,
  hacktivities, clasificación, mi cuenta, idioma) con el enlace activo resaltado, y en
  móvil un menú desplegable.
- **US2 (P1)** — Como *estudiante*, dentro de un room veo en qué path y módulo estoy,
  puedo ir al room anterior/siguiente y, al completarlo, se me propone continuar.
- **US3 (P1)** — Como *estudiante*, cuando respondo, Byte reacciona (acierto, fallo,
  varios fallos → pista, room completado, subida de nivel, error de red, sesión
  requerida) con mensajes variados y animaciones distintas.
- **US4 (P1)** — Como *estudiante*, los paths aparecen en orden CS101 → JrPT → WebApp →
  Advanced y dentro de cada módulo los rooms van de fácil a difícil, sin referencias a
  contenidos que todavía no he visto.
- **US5 (P2)** — Como *estudiante*, Byte aparece también en las secciones (hero, estados
  vacíos, carga, error, 404, dashboard, login) y puedo minimizarlo o desactivarlo.
- **US6 (P2)** — Como *estudiante*, en la página de un path y en el dashboard tengo un
  botón "Continuar donde lo dejaste".
- **US7 (P2)** — Como *usuario con sensibilidad al movimiento*, si mi sistema pide
  movimiento reducido, ninguna animación en bucle se ejecuta y el contenido es legible.
- **US8 (P3)** — Como *usuario inglés*, títulos y descripciones de paths y módulos
  también están traducidos.

## 3. Requisitos funcionales

### Shell y navegación
1. Cabecera común (sticky) en `app/[locale]/layout.tsx` con enlace activo, menú móvil
   (drawer con foco atrapado, Escape, cierre al navegar), indicador de navegación
   pendiente, y footer común. "Estado del sistema" pasa al footer.
2. Skip-link "Saltar al contenido" y `<main id="main">`.
3. Migas de pan en path, room, dashboard y certificado.
4. `GET /api/catalog/rooms/:slug/context?locale=` → path, módulo, posición y room
   anterior/siguiente (recorrido aplanado del path).
5. Login acepta `?next=` (solo rutas internas relativas — sin *open redirect*).
6. `loading.tsx`, `error.tsx` y `not-found.tsx` con Byte; esqueletos en vez de "…".
7. Room enlazable a una tarea (`?task=N`), flechas ←/→ entre tareas fuera de inputs.

### Byte
8. Componente SVG renderizable en servidor con 12 estados (`idle`, `wave`, `think`,
   `happy`, `celebrate`, `sad`, `confused`, `error`, `sleep`, `scan`, `point`, `hint`).
9. Compañero flotante con modos `full | mini | off` persistidos por navegador; en móvil
   arranca en `mini`; reacciona a eventos vía `useByte().react(evento)`.
10. Mensajes en el namespace i18n `Byte` (es/en) con ≥5 variantes por evento, sin
    repetir el último mostrado.
11. La respuesta de `POST /rooms/:slug/answers` incluye `level: { before, after }`
    cuando se otorga XP, para celebrar subidas de nivel.

### Contenido
12. Los paths declaran `order` (entero ≥1, único); el build ordena por él.
13. Traducción EN de título/descripción de paths y módulos (`translations/en/_catalog.json`);
    falta de traducción = error de build.
14. El seed re-asigna módulo→path y room→módulo al actualizar.
15. Reestructuración (ver plan §4): CS101 sin `password-attacks` y con Redes antes de
    AD; JrPT con módulo `passwords` y AD al final; `mobile-security` al final de WebApp;
    Advanced con módulo `red-team-ops`.
16. La home construye su roadmap desde `/api/catalog`; hacktivities ordena por defecto
    por recorrido recomendado (`recommended`) y ofrece orden por dificultad.

### Accesibilidad y movimiento (no estaba en la constitución)
17. `prefers-reduced-motion: reduce` desactiva bucles y transformaciones decorativas;
    Byte muestra una pose estática por estado.
18. El feedback de respuestas y los bocadillos de Byte se anuncian con `aria-live`.
19. Foco visible en todos los controles interactivos.

## 4. Criterios de éxito (verificables)

- [x] Todas las páginas comparten cabecera/footer; menú móvil operativo a 390 px.
- [x] Desde un room se navega a su path y al room siguiente; al completarlo aparece
      "Continúa con…".
- [x] Byte reacciona a acierto/fallo/pista/room completado/nivel/401/red (E2E `byte.spec`).
- [x] Con `reducedMotion: 'reduce'` las partes de Byte no animan (E2E).
- [x] `/paths` muestra CS101 primero (E2E `navigation.spec`); seed doble estable.
- [x] Build de contenido sin errores; avisos de orden revisados.
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` y `pnpm test:e2e` en verde.

## 5. Fuera de alcance

- Tema claro y selector de tema.
- Librerías de animación (motion/GSAP/Lottie/Rive) — CSS-first (ADR-014).
- Reescritura de contenido duplicado (exfiltración DNS en dos rooms, Burp en tres
  sitios): se registran como T9xx.
- Paleta de comandos / búsqueda global.

## 6. Supuestos

- Spec 106 sigue abierta en otra sesión; 010 no toca `specs/106-*` y deja la página de
  certificado para el final.
- El progreso es derivado (ADR-012): mover rooms entre módulos/paths no pierde progreso.
