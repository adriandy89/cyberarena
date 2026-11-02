# ADR-014 — Animación CSS-first y mascota Byte como SVG inline

- **Estado:** aceptada (2026-11-02, fase 010)
- **Contexto:** la fase 010 introduce una mascota robot animada ("Byte") que reacciona a
  las respuestas y aparece en secciones, además de transiciones de página y
  micro-interacciones. Opciones: (a) librería de animación JS (motion, GSAP),
  (b) assets Rive/Lottie, (c) SVG inline + CSS. La constitución exige "lo más simple
  gana" y verificar cada dependencia nueva.
- **Decisión:**
  1. **Sin librería de animación.** Keyframes y transitions CSS; `@starting-style` para
     entradas; scroll-driven animations (`animation-timeline: view()`) solo dentro de
     `@supports`, con el contenido visible como fallback.
  2. **Byte = componente React sin hooks** que dibuja un SVG con partes nombradas
     (antena, visor, ojos, párpados, boca, brazos, núcleo, propulsor). El estado visual es
     un atributo `data-mood` y un CSS module selecciona las animaciones por estado. Al no
     tener hooks se renderiza en Server Components (sin coste de hidratación inline).
  3. **Reacciones** a través de un contexto cliente (`ByteProvider` + `useByte().react()`)
     con cola por prioridad; el compañero flotante (`ByteCompanion`) consume ese estado.
     Preferencia `full | mini | off` en `localStorage` (siempre en try/catch).
  4. **Mensajes** en el namespace i18n `Byte` (es/en), arrays con variantes por evento;
     nunca texto incrustado en componentes.
  5. **Movimiento accesible**: `@media (prefers-reduced-motion: reduce)` global anula
     bucles y transformaciones; Byte muestra una pose estática por estado; los bocadillos
     muestran el texto completo sin efecto máquina de escribir; anuncios vía `aria-live`.
  6. Iconos con `lucide-react` (tree-shakeable) en lugar de emoji en la UI.
- **Consecuencias:** cero KB de runtime de animación; Byte es editable en código y
  versionable; animaciones complejas (física, morphing de paths) quedan fuera — si una
  fase futura las necesita, se reevalúa con un ADR nuevo. Sin impacto en CSP (no hay
  wasm, workers ni `blob:`).
