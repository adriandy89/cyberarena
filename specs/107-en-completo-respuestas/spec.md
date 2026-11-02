# Spec 107 — Inglés completo y respuestas que se puedan acertar

- **Estado:** completada (2026-11-02)
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión, a partir de la deuda T902 de la fase 010 y de la auditoría de
    respuestas hecha al cerrarla.
  - 2026-11-02 completada. Contenido en 8 lotes de rooms trabajados en paralelo por agentes (sin
    solaparse) y revisados uno a uno antes de cada commit. Resultado: **0 elementos sin EN** (antes
    995) y **0 respuestas-frase** (antes 86); ~70 preguntas pasaron a  con la misma id y
    cientos de respuestas aceptan variantes ES/EN. Verificación: lint/typecheck/test/build en verde
    (shared 36, content 20, api 67), seed doble estable ( guardados), E2E 24/24 contra
    un stack local, incluido  (teoría EN y "Rules of Engagement" aceptada).
  - **Errores de contenido encontrados y corregidos de paso** (no estaban en el alcance inicial):
    flag de bienvenida mal escrita en la guía; dos preguntas de flag sin solución (pedían la flag
    de otro lab o repetían la anterior); pregunta de chisel que pedía el servidor y esperaba el
    cliente; pregunta de LSASS que pedía una herramienta de Sysinternals; consejo falso «CAT evade
    un filtro sensible a mayúsculas»; reto de SSRF que no decía qué lab levantar; año de RockYou;
    script  descrito como detección de SO; enunciados en inglés dentro del español,
    mojibake y erratas.
  - **Modelos:** dos lotes (JrPT-B y Advanced) los bloqueó el filtro de seguridad de Opus por su
    temática ofensiva; se rehicieron con Sonnet con el mismo encargo y la misma revisión.

## 1. Propósito

La plataforma se anuncia bilingüe, pero en `/en` solo están traducidos los títulos y los
enunciados. Medido sobre el catálogo (59 rooms):

| Elemento | Total | Con EN |
|---|---|---|
| Cuerpos de tarea (la teoría) | 162 | 0 |
| Pistas | 491 | 0 |
| Enunciados | 491 | 486 |
| Opciones de preguntas tipo test | 85 preguntas | 0 (el formato no las admite) |

Además, las respuestas no son justas:

- **Respuestas-frase:** 86 preguntas de texto esperan 4+ palabras exactas (p. ej. "un valor
  aleatorio antes de la return address que aborta el programa si se modifica"); la comparación
  es exacta, así que son prácticamente imposibles de acertar, en español o en inglés.
- **Respuestas solo en español:** cada pregunta guarda un único hash, así que en `/en` la
  respuesta a "What is the initial phase…?" solo acepta "reconocimiento".

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante en inglés*, leo la teoría, las pistas y las opciones en inglés.
- **US2 (P1)** — Como *estudiante*, toda pregunta se puede acertar con una respuesta razonable:
  los conceptos se preguntan como test y los términos aceptan sus variantes (ES/EN).
- **US3 (P2)** — Como *autor*, el build me dice qué falta por traducir y no deja publicar
  contenido sin inglés.

## 3. Requisitos

1. `translations/en/<room>.json` admite `questions[id].options` (`{ "<optionId>": "label" }`).
2. `private/answers/<room>.yaml` admite una lista de respuestas aceptadas; la primera es la
   canónica. El seed guarda todas hasheadas (`Answer.altHashes`) y la API acepta cualquiera.
3. El validador comprueba que la respuesta de una pregunta `choice` es una de sus opciones.
4. Preguntas de texto con respuesta-frase → `choice` (misma id, progreso intacto) o respuesta
   corta con alternativas. Las respuestas que son comandos o literales técnicos se mantienen.
5. Términos en español aceptan su equivalente inglés y variantes razonables (plural, tildes).
6. Cobertura EN completa: cuerpo, título, enunciado, pista y opciones de cada pregunta. El build
   informa de lo que falta (`--en-report`) y, al cerrar la fase, falla si falta algo.
7. Nunca se traducen comandos, flags, rutas, URLs, payloads ni salidas de terminal.

## 4. Criterios de éxito

- [x] 0 elementos sin EN en el informe de cobertura; el build falla si aparece uno nuevo.
- [x] 0 respuestas de texto en lenguaje natural de 4+ palabras.
- [x] Una pregunta con alternativas se acierta en ES y en EN (test de API + E2E en `/en`).
- [x] `pnpm lint && typecheck && test && build` y `pnpm test:e2e` en verde; seed doble estable.

## 5. Fuera de alcance

- Traducir la intro de `index.mdx` de cada room (el build no la publica).
- Nuevos rooms o cambios de dificultad.

## 6. Supuestos

- El progreso se guarda por id de pregunta: cambiar `text` → `choice` no lo invalida.
