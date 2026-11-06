# Registro de decisiones del Product Owner

Decisiones que cierran los supuestos de la fase de requerimientos. Cada una se refleja en el SRS v1.2 y en las historias afectadas.

| ID | Fecha | Decisión | Impacto |
|---|---|---|---|
| D-01 | 2026-10-22 | Reparto por defecto con desayuno, proporcional a 20/50/30: desayuno + almuerzo = 29/71, desayuno + cena = 40/60. Editable. | RN-06 · HU-06, HU-07 |
| D-02 | 2026-10-22 | Cada comensal tiene un **factor de porción** sugerido en 1.0 y editable (0.25 a 2.0, pasos de 0.25). Las cantidades escalan con la suma de factores. | RN-07 · HU-03, HU-12, HU-28 · tabla `Comensal.factorPorcion` |
| D-03 | 2026-10-22 | Un menú que excede el presupuesto **se puede aprobar**, pero el exceso se indica visualmente (rojo, "Excede por Q__") en el menú, al aprobar y en la lista. No se bloquea ni se exige diálogo extra. | RN-11 · HU-25, HU-26, HU-28 |
| D-04 | 2026-10-22 | Un menú aprobado guarda una copia de la configuración con que se aprobó (tiempos y presupuesto). | HU-07, HU-25, HU-39 |
| D-05 | 2026-10-22 | Catálogo de productos y precios automáticos **comunes** a todos los hogares; platillos y precios manuales son de cada hogar. | Modelo de datos · HU-13, HU-34, HU-35 |
| D-06 | 2026-10-22 | Las 18 fotos del cuaderno las transcribe Claude a la plantilla CSV en S2; el PO revisa. La app no lleva OCR de menús. | HU-18 |
| D-07 | 2026-10-22 | La extracción automática de precios queda **apagada por sitio** hasta revisar los términos de uso. | RF-33, PA-02 · HU-33 |
| D-08 | 2026-10-22 | El recordatorio de planificación llega el domingo a las 08:00 (hora de Guatemala). | HU-41 |
| D-09 | 2026-10-22 | ~~Hosting en servidor propio en casa~~ (reemplazada por D-11). Hosting en **servidor propio en casa** con Docker Compose. Disponibilidad objetivo 95 % mensual. | R-05, RNF-03, PA-01 · ADR-002 |
| D-10 | 2026-10-22 | Nuevos requerimientos: lista de ingredientes con check y **avance por comida** hasta "Lista para preparar" (RF-43), y **precio real opcional** al comprar con precio promedio de compra por producto (RF-44). | SRS v1.3 · RN-12, RN-13 · HU-43, HU-44 (S4) |
| D-11 | 2026-10-22 | Producción en **Oracle Cloud Always Free ARM (Ampere A1)**; la laptop existente queda para desarrollo y pruebas. Reemplaza D-09. Disponibilidad objetivo 99 % mensual. | R-05, RNF-03 · ADR-009 (reemplaza ADR-002) |
| D-12 | 2026-10-22 | Dominio gratis **DuckDNS** con HTTPS automático (Caddy + Let's Encrypt). | ADR-009 · IE-04 |
| D-13 | 2026-10-22 | Correo de invitaciones y recuperación con **Gmail + contraseña de aplicación** (SMTP), cambiable por configuración. | IE-03 · HU-02, HU-04 |
| D-14 | 2026-10-22 | Se aprueba ADR-004: token de acceso de 15 min y refresh rotativo de 30 días. | HU-01 |
| D-15 | 2026-10-22 | Se cambia Prisma por **Drizzle ORM** (TypeScript puro, sin motores binarios) para poder probar contra PostgreSQL real en todos los entornos. | R-01 · ADR-010 |
| D-16 | 2026-10-23 | El **despliegue en Oracle Cloud se hace en el Sprint 6** (último). Hasta entonces la app se prueba en la laptop con `docker-compose.dev.yml` y `pnpm dev`; el correo queda en modo consola hasta configurar Gmail. | Plan de sprints · ADR-009 · despliegue.md |
| D-17 | 2026-10-30 | Se aprueban las fórmulas de los factores del motor (Preferencia, Novedad, Ahorro y Afinidad) y los pesos por defecto 0.40 / 0.25 / 0.20 / 0.15, editables por el administrador. | M05 · CU-05.2 · HU-20 |
| D-18 | 2026-10-30 | Un platillo con **costo incompleto** (ingredientes sin precio o sin ingredientes) recibe **Ahorro neutro 0.50**, para que no suba ni baje artificialmente en el puntaje. Se sigue marcando "Costo incompleto". | M05 · CU-05.2, CU-05.3 · HU-20, HU-21 |
| D-19 | 2026-10-30 | La ventana de 16 semanas de Afinidad y el cálculo de Novedad se miden **hacia atrás desde la última semana con historial** cuando la semana planificada queda lejos de los datos (el cuaderno termina en mayo de 2026). | M05 · CU-05.2 · HU-20 |
| D-20 | 2026-10-30 | Antes de iniciar el Sprint 3 se completan los ingredientes de los platillos de almuerzo más usados, para probar el motor con datos reales. | M03 · HU-12 · HU-19, HU-20, HU-21 |
| D-21 | 2026-10-30 | El umbral de similitud de la resolución de platillos queda en **80 %** (`UMBRAL_SIMILITUD`). | HU-17 |

Se mantiene como propuesto, sin objeción del PO, que la alerta del 10 % se calcule sobre el total semanal (M10, CU-12.2). Las fórmulas del motor (M05, CU-05.2) quedaron aprobadas en D-17 a D-19.
