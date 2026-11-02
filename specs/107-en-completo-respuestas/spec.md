# Spec 107 — Inglés completo y respuestas que se puedan acertar

- **Estado:** en curso
- **Creada:** 2026-11-02
- **Changelog:**
  - 2026-11-02 primera versión, a partir de la deuda T902 de la fase 010 y de la auditoría de
    respuestas hecha al cerrarla.

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

- [ ] 0 elementos sin EN en el informe de cobertura; el build falla si aparece uno nuevo.
- [ ] 0 respuestas de texto en lenguaje natural de 4+ palabras.
- [ ] Una pregunta con alternativas se acierta en ES y en EN (test de API + E2E en `/en`).
- [ ] `pnpm lint && typecheck && test && build` y `pnpm test:e2e` en verde; seed doble estable.

## 5. Fuera de alcance

- Traducir la intro de `index.mdx` de cada room (el build no la publica).
- Nuevos rooms o cambios de dificultad.

## 6. Supuestos

- El progreso se guarda por id de pregunta: cambiar `text` → `choice` no lo invalida.
