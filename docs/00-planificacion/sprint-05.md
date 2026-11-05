# Sprint 5 — Precios y marcas

| Campo | Valor |
|---|---|
| Fechas planificadas | 2027-01-04 → 2027-01-15 |
| Objetivo | Tener precios por supermercado y usarlos: elegir dónde y qué marca comprar, registrar precios, ver el mínimo y agrupar la lista |
| Estado | En curso. HU-09 implementada y validada por el PO el 2026-11-05. HU-35 implementada el 2026-11-05 (pendiente la validación manual del PO) |

## Historias

| HU | Historia | Módulo | Puntos | Depende de (propuesta) |
|---|---|---|---|---|
| HU-09 | Supermercados y marcas preferidas | M02 | 5 | — |
| HU-31 | Agrupar la lista por supermercado y categoría | M07 | 5 | HU-09, HU-34, HU-36 |
| HU-33 | Precios automáticos de Walmart y Paiz | M08 | 13 | HU-35 |
| HU-34 | Registrar precios a mano o por ticket | M08 | 8 | — |
| HU-35 | Vincular productos con cada supermercado | M08 | 5 | — |
| HU-36 | Costo con mediana y precio mínimo sugerido | M08 | 5 | HU-34, HU-09 |
| HU-37 | Histórico de precios | M08 | 5 | HU-34 |
| HU-38 | Último precio válido cuando falla la consulta | M08 | 5 | HU-33 |

La suma de puntos es la del plan (51).

## Orden de trabajo propuesto

El PO aprobó empezar por HU-09 (2026-11-05). HU-31 necesita precios y un precio mínimo, así que va después de ellos. Las
dependencias entre HU-34, HU-35 y HU-36 se revisan al llegar a cada una:

1. **HU-09:** supermercados y marcas preferidas (listo).
2. **HU-35** (listo) **y HU-34:** vincular productos con cada supermercado y registrar precios; sin ellos no hay marcas que elegir ni precios que comparar.
3. **HU-36:** mediana para el costo y mínimo entre supermercados preferidos.
4. **HU-31:** lista agrupada por supermercado y categoría; el texto de compartir (HU-32) debe seguir esa agrupación.
5. **HU-37, HU-33 y HU-38:** histórico, precios automáticos y último precio válido. HU-33 queda sujeta a la revisión de los términos de uso de cada sitio (PA-02, R-03, D-07).

## Notas

- HU-09 deja guardadas las preferencias, pero todavía no cambian ninguna sugerencia: el precio mínimo (HU-36) y la lista agrupada (HU-31) son quienes las usan.
- El marcado de marcas depende de los vínculos de HU-35; sin ellos la pantalla dice "Sin marcas vinculadas".
