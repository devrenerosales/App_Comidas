# Sprint 4 — Lista de compras con avance y precio real

| Campo | Valor |
|---|---|
| Fechas planificadas | 2026-12-07 → 2026-12-18 |
| Objetivo | Convertir el menú aprobado en una lista de compras que se pueda usar, marcar y compartir, y registrar lo que realmente se gasta |
| Estado | En curso. HU-28 implementada el 2026-11-03. HU-30 implementada el 2026-11-03. HU-43 implementada el 2026-11-03. HU-44 implementada el 2026-11-03. HU-27 implementada el 2026-11-03. HU-29 implementada el 2026-11-04 |

## Historias

| HU | Historia | Módulo | Puntos | Depende de (propuesta) |
|---|---|---|---|---|
| HU-27 | Registrar gasto real | M06 | 3 | HU-25 |
| HU-28 | Consolidar ingredientes del menú aprobado | M07 | 8 | HU-25 |
| HU-29 | Agregar despensa según frecuencia | M07 | 5 | HU-28 |
| HU-30 | Editar y marcar la lista (también sin conexión) | M07 | 8 | HU-28 |
| HU-32 | Compartir la lista | M07 | 2 | HU-28 |
| HU-43 | Avance de compra por comida | M07 | 5 | HU-30 |
| HU-44 | Precio real al marcar comprado | M07 | 8 | HU-30 |

La suma de puntos es la del plan (39). HU-31 (agrupar por supermercado) se planifica en otro sprint.

## Orden de trabajo propuesto

1. **HU-28:** consolidar al aprobar el menú; es la base de las demás.
2. **HU-30, HU-43 y HU-44:** marcar, avance por comida y precio real, sobre los ítems y sus vínculos con las comidas.
3. **HU-29 y HU-32:** despensa y compartir.
4. **HU-27:** gasto real de la semana.

## Decisiones del PO que afectan al sprint

| Decisión | Efecto |
|---|---|
| D-02 | La escala usa la suma de factores de porción de los comensales activos |
| D-03 | La lista muestra en rojo "Excede por Q__" si el menú se aprobó con exceso |
| D-04 | Se usa la Σ de factores congelada al aprobar |
