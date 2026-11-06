# Sprint 5 — Precios y marcas

| Campo | Valor |
|---|---|
| Fechas planificadas | 2027-01-04 → 2027-01-15 |
| Objetivo | Tener precios por supermercado y usarlos: elegir dónde y qué marca comprar, registrar precios, ver el mínimo y agrupar la lista |
| Estado | En curso. HU-09 implementada y validada por el PO el 2026-11-05. HU-35 implementada y validada por el PO el 2026-11-05. HU-34 en curso: la parte manual implementada y validada por el PO el 2026-11-05, falta el ticket con OCR. HU-36 implementada el 2026-11-05 y validada por el PO el 2026-11-06. HU-31 implementada el 2026-11-05 (pendiente la validación manual del PO) |

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
2. **HU-35** (listo) **y HU-34** (parte manual lista; falta el ticket con OCR): vincular productos con cada supermercado y registrar precios; sin ellos no hay marcas que elegir ni precios que comparar.
3. **HU-36** (listo)**:** mediana para el costo y mínimo entre supermercados preferidos.
4. **HU-31** (listo)**:** lista agrupada por supermercado y categoría; el texto de compartir (HU-32) debe seguir esa agrupación.
5. **HU-37, HU-33 y HU-38:** histórico, precios automáticos y último precio válido. HU-33 queda sujeta a la revisión de los términos de uso de cada sitio (PA-02, R-03, D-07).

## Notas

- Los supermercados preferidos (HU-09) ya filtran el precio mínimo que calcula HU-36; la lista agrupada (HU-31) mostrará esa compra sugerida.
- La marca preferida (HU-09) todavía no filtra el mínimo, ni siquiera en la lista agrupada (HU-31): ninguno de los criterios de HU-31 la pide; queda como decisión del PO.
- La lista agrupada (HU-31) se calcula en la app con los precios mínimos de HU-36; la API entrega por ítem la categoría y la compra sugerida.
- El resumen de precios (HU-36) alimenta lo que ya leían el costo del menú y la lista: la mediana. Se recalcula al registrar un precio, al cambiar los supermercados preferidos y al generar un menú.
