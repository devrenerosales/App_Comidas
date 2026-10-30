# Sprint 3 — Motor de sugerencias y plan semanal

| Campo | Valor |
|---|---|
| Fechas planificadas | 2026-11-23 → 2026-12-04 |
| Objetivo | Proponer el menú semanal con puntaje, presupuesto y motivo; permitir ajustarlo, aprobarlo y ver su costo |
| Estado | Planificado. Fórmulas del motor aprobadas por el PO el 2026-10-30 (D-17 a D-19) |

## Historias

| HU | Historia | Módulo | Puntos | Depende de |
|---|---|---|---|---|
| HU-10 | Restricciones y gustos | M02 | 5 | S1 |
| HU-14 | Calificar platillo | M03 | 3 | S1 |
| HU-20 | Puntaje de platillos | M05 | 5 | HU-10, HU-14, historial de S2 |
| HU-19 | Generar propuesta de menú | M05 | 8 | HU-20 |
| HU-21 | Ajustar al presupuesto | M05 | 5 | HU-19 |
| HU-22 | Ver el motivo de la sugerencia | M05 | 3 | HU-19 |
| HU-23 | Pedir alternativa para un día | M05 | 3 | HU-19, HU-20 |
| HU-24 | Editar, mover y fijar platillos | M06 | 8 | HU-19 |
| HU-25 | Aprobar menú | M06 | 5 | HU-24 |
| HU-26 | Ver costo estimado vs. presupuesto | M06 | 5 | HU-21 |
| | **Total** | | **50** | |

## Orden de trabajo propuesto

1. **Base de datos y datos de entrada:** HU-10 (exclusiones) y HU-14 (calificaciones) alimentan el
   puntaje; sin ellas la Preferencia vale 0.50 para todos los platillos.
2. **Motor puro:** HU-20 como funciones sin acceso a datos, probadas con el ejemplo numérico de
   CU-05.2 (0.6375, 0.6075 y 0.4750). Después HU-19 y HU-21 sobre esas funciones.
3. **Plan semanal:** HU-24, HU-25 y HU-26 sobre el menú Borrador que genera el motor.
4. **Explicación y alternativas:** HU-22 y HU-23, que reutilizan factores y exclusiones.

## Decisiones del PO que afectan al sprint

| Decisión | Efecto |
|---|---|
| D-17 | Fórmulas y pesos por defecto 0.40 / 0.25 / 0.20 / 0.15 |
| D-18 | Costo incompleto → Ahorro neutro 0.50 y marca "Costo incompleto" |
| D-19 | Afinidad y Novedad se miden desde la última semana con historial si la semana planificada queda lejos de los datos |
| D-20 | Completar ingredientes de los platillos de almuerzo más usados antes del sprint |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| 47 de los 48 platillos están incompletos (sin ingredientes ni precios) | D-18 evita que distorsionen el Ahorro; D-20 completa los más usados |
| El historial del cuaderno termina en mayo de 2026 | D-19 mide la ventana desde la última semana con datos |
| Se exigen 10 platillos activos por tiempo de comida activo | Probar con solo almuerzo; la cena exige más platillos |
| El motor es de otra naturaleza que el CRUD de S1 y S2 (estimación incierta) | Funciones puras con pruebas del ejemplo numérico antes de integrar |
| Rendimiento: p95 menor a 3 s con 300 platillos (RNF-01) | Prueba de rendimiento en HU-19 |

## Pendientes heredados

- Prueba de entrega de correo con SMTP real.
- Pruebas E2E con Playwright, capturas del manual y refresh seguro en Android (S1).
- Revisión del PO del reporte de conciliación del cuaderno cargado.
