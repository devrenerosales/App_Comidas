# Casos de uso e historias de usuario — Menú Familiar

| Campo | Valor |
|---|---|
| Documento | CUH-MF-001 |
| Versión | 1.1 (decisiones D-01..D-09 y RF-43, RF-44; D-11..D-15 agregadas el 2026-10-22) |
| Fecha | 2026-10-22 |
| Base | SRS-MF-001 v1.3 (aprobado 2026-10-22) |
| Fase del ciclo de vida | 2. Requerimientos — análisis de casos de uso, historias y criterios de aceptación |
| Prototipo de referencia | [Prototipo App Menús Familiares](https://claude.ai/artifact/E5BNpQxh3ianZUmYpBmSLz) (2026-10-21) |

La especificación cubre los 44 requerimientos funcionales del SRS v1.3 (RF-43 y RF-44 se agregaron a pedido del PO). Cada uno tiene su caso de uso detallado, una historia de usuario con criterios de aceptación en Gherkin y sus subtareas estimadas. En total son **44 casos de uso, 44 historias, 243 puntos y 804 horas estimadas**, con 101 diagramas Mermaid validados (todos renderizan sin errores).

## 1. Índice de documentos

| Archivo | Módulo | RF | Casos de uso | Sprint(s) | Puntos | Horas |
|---|---|---|---|---|---|---|
| [M01-cuenta-hogar.md](M01-cuenta-hogar.md) | Cuenta y hogar | RF-01–04 | CU-01.1–01.4 | S1 | 21 | 76 |
| [M02-configuracion.md](M02-configuracion.md) | Configuración | RF-05–10 | CU-02.1–02.6 | S1, S3, S5 | 30 | 96 |
| [M03-catalogo.md](M03-catalogo.md) | Catálogo de platillos | RF-11–14 | CU-03.1–03.3, CU-11.1 | S1, S3 | 18 | 74 |
| [M04-carga-historica.md](M04-carga-historica.md) | Carga histórica | RF-15–18 | CU-04.1–04.4 | S2 | 26 | 85 |
| [M05-motor-sugerencias.md](M05-motor-sugerencias.md) | Motor de sugerencias | RF-19–23 | CU-05.1–05.5 | S3 | 24 | 92 |
| [M06-plan-semanal.md](M06-plan-semanal.md) | Plan semanal | RF-24–27 | CU-06.1–06.4 | S3, S4 | 21 | 65 |
| [M07-lista-compras.md](M07-lista-compras.md) | Lista de compras | RF-28–32, RF-43–44 | CU-07.1–07.7 | S4, S5 | 41 | 126 |
| [M08-precios.md](M08-precios.md) | Precios | RF-33–38 | CU-08.1–08.3, CU-09.1–09.3 | S5 | 41 | 121 |
| [M09-reportes.md](M09-reportes.md) | Reportes | RF-39–40 | CU-10.1–10.2 | S6 | 8 | 31 |
| [M10-notificaciones.md](M10-notificaciones.md) | Notificaciones | RF-41–42 | CU-12.1–12.2 | S6 | 13 | 38 |
| **Total** | | **44** | **44** | | **243** | **804** |

[_PLANTILLA.md](_PLANTILLA.md) define la estructura, los IDs y las reglas Mermaid que siguen todos los módulos.

## 2. Convenciones

| Elemento | Formato | Regla |
|---|---|---|
| Caso de uso macro | `CU-xx` | Los 11 del SRS §8 + **CU-12 Recibir notificaciones** (nuevo en SRS v1.1) |
| Caso de uso detallado | `CU-xx.y` | Uno por RF, dentro de su macro |
| Historia de usuario | `HU-nn` | nn = número del RF (RF-05 → HU-05) |
| Criterio de aceptación | `CA-nn.k` | Cada escenario Gherkin; origen del caso de prueba `PF-Mx-nn.k` (fase 5) |
| Subtarea | `ST-nn.k` | Tipos DB, BE, FE, QA, DOC, DevOps; 1–8 h |
| Estimación | Puntos Fibonacci | 1, 2, 3, 5, 8, 13 |

## 3. Diagrama general de casos de uso

```mermaid
flowchart LR
  ADM(("Administrador del hogar"))
  MIE(("Miembro del hogar"))
  WRK(("Worker de precios"))
  SCH(("Programador de tareas"))

  subgraph APP["Menú Familiar"]
    CU01(["CU-01 Gestionar cuenta y hogar"])
    CU02(["CU-02 Configurar tiempos y presupuesto"])
    CU03(["CU-03 Gestionar platillos e ingredientes"])
    CU04(["CU-04 Cargar historial"])
    CU05(["CU-05 Generar menú semanal"])
    CU06(["CU-06 Ajustar y aprobar menú"])
    CU07(["CU-07 Gestionar lista de compras"])
    CU08(["CU-08 Registrar y vincular precios"])
    CU09(["CU-09 Actualizar precios automáticos"])
    CU10(["CU-10 Consultar reportes"])
    CU11(["CU-11 Calificar platillo"])
    CU12(["CU-12 Recibir notificaciones"])
  end

  ADM --> CU01
  ADM --> CU02
  ADM --> CU04
  MIE --> CU03
  MIE --> CU05
  MIE --> CU06
  MIE --> CU07
  MIE --> CU08
  MIE --> CU10
  MIE --> CU11
  MIE --> CU12
  WRK --> CU09
  SCH --> CU12
  ADM -. "hereda" .-> MIE
  CU06 -. "«include»" .-> CU07
  CU05 -. "«include»" .-> CU09
  CU12 -. "«extend»" .-> CU05
```

## 4. Backlog priorizado por sprint

```mermaid
flowchart LR
  S1["S1 · 11 HU · 56 pts<br>Hogar, configuración, catálogo"] --> S2["S2 · 4 HU · 26 pts<br>Carga inicial"]
  S2 --> S3["S3 · 10 HU · 50 pts<br>Motor y plan semanal"]
  S3 --> S4["S4 · 7 HU · 39 pts<br>Lista de compras, avance y precio real"]
  S4 --> S5["S5 · 8 HU · 51 pts<br>Precios y marcas"]
  S5 --> S6["S6 · 4 HU · 21 pts<br>Reportes, notificaciones, APK"]
```

| Sprint | Historias | Puntos | Horas |
|---|---|---|---|
| S1 | HU-01, 02, 03, 04, 05, 06, 07, 08, 11, 12, 13 | 56 | 202 |
| S2 | HU-15, 16, 17, 18 | 26 | 85 |
| S3 | HU-10, 14, 19, 20, 21, 22, 23, 24, 25, 26 | 50 | 173 |
| S4 | HU-27, 28, 29, 30, 32, 43, 44 | 39 | 124 |
| S5 | HU-09, 31, 33, 34, 35, 36, 37, 38 | 51 | 151 |
| S6 | HU-39, 40, 41, 42 | 21 | 69 |
| **Total** | **44** | **243** | **804** |

**Riesgo de capacidad:** S1, S3 y S5 superan 150 h en 2 semanas y S4 sube a 124 h con RF-43 y RF-44. Si el equipo es una sola persona a medio tiempo (~40 h por sprint), hay que medir la velocidad real en S1 y replanificar: mover las HU "S" y "C" (HU-04, 08, 22, 32, 37, 40) a sprints posteriores o alargar el plan.

## 5. Definición de listo (DoR)

Una historia entra al sprint cuando:

- [ ] Tiene caso de uso con diagramas de actividad y de secuencia.
- [ ] Tiene al menos 3 criterios de aceptación en Gherkin con datos concretos.
- [ ] Está estimada en puntos y dividida en subtareas de máximo 8 h.
- [ ] Sus dependencias están terminadas o planificadas en el mismo sprint.
- [ ] El PO validó los supuestos marcados en su especificación y es consistente con las decisiones D-01..D-09.

## 6. Definición de terminado (DoD)

Una historia se cierra cuando:

- [ ] El código está revisado y fusionado en `develop` (el PO hace el push).
- [ ] Las pruebas unitarias pasan con cobertura ≥ 70 % en el módulo (RNF-09).
- [ ] Todos sus CA-nn.k pasan como pruebas funcionales y se agregan a la regresión.
- [ ] Cumple los RNF que cita (rendimiento, seguridad, offline, accesibilidad).
- [ ] La sección del manual de usuario está escrita (`docs/05-manual-usuario/`).
- [ ] El PO aceptó la historia en la revisión del sprint.

## 7. Trazabilidad con el prototipo

| Pantalla del prototipo | Historias que cubre | Brecha a diseñar en fase 3 |
|---|---|---|
| Móvil · Login | HU-01 | Registro y recuperación de contraseña (HU-04) |
| Móvil · Inicio (personas, presupuesto ±Q10) | HU-03, HU-06 | Factor de porción por comensal 0.25–2.0 (HU-03, D-02); selector de tiempos de comida y vista previa del reparto (HU-05, HU-07) |
| Móvil · Semana (fijar, cambiar con alternativas) | HU-19, HU-23, HU-24 | Motivo de la sugerencia (HU-22), aprobar con exceso en rojo "Excede por Q__" sin diálogo extra (HU-25, D-03) |
| Móvil · Lista de compras con checks | HU-28, HU-30 | Despensa (HU-29), agrupación por supermercado (HU-31), compartir (HU-32) |
| Móvil · `Lista-progreso.dc.html` · Avance de compra y precio real (nueva) | HU-30, HU-43, HU-44 | Pestaña "Por comida" con avance y "Lista para preparar", estado "Ya lo tengo", campo "Precio pagado" al marcar comprado y promedio de compra junto a la mediana |
| Móvil · Platillos | HU-11 | Ingredientes por porción (HU-12), calificación (HU-14) |
| Web · Semana (costo vs presupuesto, Cambiar, Aceptar y generar lista) | HU-25, HU-26 | Vista de 2 o 3 tiempos por día |
| Web · Precios por tienda (mínimo y mediana) | HU-36 | Registro manual o por ticket (HU-34), vinculación (HU-35), histórico (HU-37) |
| Web · Semanas anteriores | HU-27, HU-39 | Gráfica de 12 semanas, frecuentes y olvidados (HU-40) |
| — sin pantalla — | HU-02, 08, 09, 10, 13, 15–18, 33, 38, 41, 42 | Hogar e invitaciones, configuración, importación, notificaciones |

El prototipo muestra solo almuerzos. Con la configuración de tiempos de comida (HU-05), la vista semanal debe poder mostrar 2 o 3 tiempos por día.

## 8. Decisiones del PO

Los supuestos de mayor impacto quedaron cerrados por el PO el 2026-10-22. El registro completo está en [docs/00-planificacion/decisiones-po.md](../../00-planificacion/decisiones-po.md); cada módulo las cita como "Decisión D-0n" en la especificación afectada.

| ID | Decisión | Módulos e historias |
|---|---|---|
| D-01 | Reparto con desayuno proporcional a 20/50/30: desayuno + almuerzo = 29/71, desayuno + cena = 40/60, editable | M02 · HU-06, HU-07 |
| D-02 | Cada comensal tiene factor de porción sugerido 1.0, editable de 0.25 a 2.0 en pasos de 0.25; las cantidades escalan con Σ factores | M01, M03, M05, M07 · HU-03, HU-12, HU-21, HU-28 |
| D-03 | Un menú que excede el presupuesto se aprueba sin diálogo extra; el exceso se muestra en rojo "Excede por Q__" en el menú, al aprobar y en la lista, y queda registrado | M06, M07 · HU-25, HU-26, HU-28 |
| D-04 | El menú aprobado guarda copia de la configuración con que se aprobó | M02, M06 · HU-07, HU-25, HU-39 |
| D-05 | Catálogo de productos y precios automáticos comunes; platillos y precios manuales por hogar | M03, M08 · HU-13, HU-34, HU-35 |
| D-06 | Claude transcribe las 18 fotos del cuaderno a la plantilla CSV en S2 y el PO revisa; sin OCR de menús | M04 · HU-18 |
| D-07 | Extracción automática de precios apagada por sitio hasta revisar términos de uso | M08 · HU-33 |
| D-08 | Recordatorio de planificación el domingo a las 08:00 (hora de Guatemala) | M10 · HU-41 |
| D-09 | ~~Hosting en servidor propio en casa con Docker Compose, disponibilidad 95 % mensual~~ (reemplazada por D-11) | Diseño · RNF-03 |
| D-11 | Producción en Oracle Cloud Always Free ARM con Docker Compose, disponibilidad 99 % mensual (ADR-009) | Diseño · R-05, RNF-03 |
| D-12 | Dominio DuckDNS con HTTPS automático (Caddy + Let's Encrypt) | Diseño · S-03 |
| D-13 | Correo con Gmail SMTP y contraseña de aplicación | HU-02, HU-04 · IE-03 |
| D-14 | ADR-004 aprobado: acceso 15 min + refresh rotativo 30 días | HU-01 |
| D-15 | Drizzle ORM en lugar de Prisma (ADR-010) | R-01 · subtareas DB |

Siguen como propuestos, sin objeción del PO: las fórmulas de los factores del motor (M05, CU-05.2) y que la alerta del 10 % se calcule sobre el total semanal (M10, CU-12.2). Los demás supuestos de detalle se mantienen en cada especificación.

## 9. Siguiente fase

Con la aprobación de este documento se pasa a la fase 3, Diseño (`docs/02-diseno/`): arquitectura, ER detallado, diagramas de secuencia técnicos y diseño de las pantallas faltantes en el prototipo.
