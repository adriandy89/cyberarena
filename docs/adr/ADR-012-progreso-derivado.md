# ADR-012 — Progreso derivado de QuestionSolved (sin desnormalización)

- **Estado:** aceptada (2026-11-01, fase 004)
- **Contexto:** los % de progreso por room/módulo/path alimentan varias vistas (página de
  path, dashboard). Opciones: denormalizar contadores en Room/Path al resolver preguntas,
  o calcular al leer desde `QuestionSolved`.
- **Decisión:** **derivar al leer**: las consultas de progreso cargan el catálogo
  (rooms + question ids) y un solo `findMany` de `QuestionSolved` del usuario, y agregan
  en memoria (escala personal: decenas de rooms × decenas de preguntas).
- **Alternativas descartadas:** contadores denormalizados (consistencia extra y triggers
  en cada respuesta; la fuente de verdad se duplica); vistas SQL materializadas
  (overkill a esta escala, revisitable si el catálogo crece a cientos de rooms).
- **Consecuencias:** cero riesgo de drift (el progreso SIEMPRE coincide con lo resuelto),
  código simple y testeable; el coste es una consulta agregada por vista (despreciable
  aquí). El `% de room` es preguntas resueltas/total — coherente con lo que otorga XP.
