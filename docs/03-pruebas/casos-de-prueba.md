# Casos de prueba funcionales — Menú Familiar

| Campo | Valor |
|---|---|
| Documento | CP-MF-001 |
| Base | CUH-MF-001 v1.1 (historias M01–M10), SRS-MF-001 v1.3 |
| Fase del ciclo de vida | 5. Pruebas |
| Generado por | `docs/03-pruebas/scripts/extraer_casos.py` (no editar a mano; regenerar) |
| Casos | **186** (= 186 escenarios Gherkin en las historias) |
| Casos de regresión (`@regresion`, prioridad M) | **133** |

Cada caso `PF-Mx-nn.k` corresponde al criterio de aceptación `CA-nn.k` de la historia `HU-nn` y se ejecuta desde `features/HU-nn.feature`. Los pasos completos están en el `.feature`.

## 1. Resumen

### 1.1 Por módulo

| Módulo | HU | Casos | Funcional | Negativo | Límite | @regresion |
|---|---|---|---|---|---|---|
| M01 Cuenta y hogar | 4 | 17 | 8 | 8 | 1 | 14 |
| M02 Configuración | 6 | 25 | 15 | 7 | 3 | 13 |
| M03 Catálogo de platillos e ingredientes | 4 | 17 | 9 | 8 | 0 | 13 |
| M04 Carga histórica | 4 | 17 | 9 | 8 | 0 | 17 |
| M05 Motor de sugerencias | 5 | 20 | 15 | 5 | 0 | 16 |
| M06 Plan semanal | 4 | 16 | 11 | 4 | 1 | 12 |
| M07 Lista de compras | 7 | 33 | 22 | 8 | 3 | 26 |
| M08 Precios | 6 | 26 | 10 | 7 | 9 | 22 |
| M09 Reportes | 2 | 7 | 4 | 2 | 1 | 0 |
| M10 Notificaciones | 2 | 8 | 3 | 2 | 3 | 0 |
| **Total** | **44** | **186** | **106** | **59** | **21** | **133** |

### 1.2 Por nivel y automatización

| Clasificación | Casos | % |
|---|---|---|
| unitaria | 25 | 13 % |
| integración | 115 | 62 % |
| E2E | 46 | 25 % |
| Automatizable: Sí | 175 | 94 % |
| Automatizable: Parcial | 11 | 6 % |

### 1.3 Suite de regresión acumulada por sprint

| Sprint | Casos nuevos | Nuevos @regresion | @regresion acumulados | Casos totales acumulados | HU que aportan a regresión |
|---|---|---|---|---|---|
| S1 | 47 | 40 | 40 | 47 | HU-01, HU-02, HU-03, HU-05, HU-06, HU-07, HU-11, HU-12, HU-13 |
| S2 | 17 | 17 | 57 | 64 | HU-15, HU-16, HU-17, HU-18 |
| S3 | 40 | 28 | 85 | 104 | HU-19, HU-20, HU-21, HU-23, HU-24, HU-25, HU-26 |
| S4 | 33 | 26 | 111 | 137 | HU-28, HU-29, HU-30, HU-43, HU-44 |
| S5 | 34 | 22 | 133 | 171 | HU-33, HU-34, HU-35, HU-36, HU-38 |
| S6 | 15 | 0 | 133 | 186 | — |

Al cierre de cada sprint se ejecutan los casos del sprint más la suite `@regresion` acumulada:
`npx cucumber-js --tags "@regresion or @S4"` (o el filtro equivalente de Playwright `--grep`).

## 2. Reglas de clasificación

| Columna | Regla (heurística revisable por QA) |
|---|---|
| Tipo | **límite** si la etiqueta del CA o el título cita un umbral (vigencia de 14 días, 10 %, redondeo, empate, par/impar, máximos) o es un `Esquema del escenario`; **negativo** si es validación, error, excepción, permisos, aislamiento, conflicto o falla; si no, **funcional**. |
| Nivel | **E2E** si involucra modo sin conexión o compartir, o es el flujo principal; **unitaria** si es cálculo puro (HU-07, HU-20, HU-21, HU-36, conversiones, mediana, empates); si no, **integración** (API NestJS + PostgreSQL con Supertest). |
| Automatizable | **Parcial** cuando depende de push/FCM, ticket/foto, compartir nativo o revisión del PO: se automatiza con dobles y se completa con verificación manual; si no, **Sí**. |
| Prioridad / Sprint | Tabla resumen (§3) de cada módulo. Prioridad M → `@regresion`. |

## 3. Casos por módulo

### M01 — Cuenta y hogar (17 casos, 14 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M1-01.1 | HU-01 | Registro exitoso de un usuario nuevo | funcional | E2E | Sí | S1 | M |
| PF-M1-01.2 | HU-01 | Registro con un correo ya existente | negativo | integración | Sí | S1 | M |
| PF-M1-01.3 | HU-01 | Bloqueo por intentos fallidos | negativo | integración | Sí | S1 | M |
| PF-M1-01.4 | HU-01 | Contraseña que no cumple la política | negativo | integración | Sí | S1 | M |
| PF-M1-02.1 | HU-02 | Crear hogar e invitar por correo | funcional | E2E | Sí | S1 | M |
| PF-M1-02.2 | HU-02 | Unirse con enlace compartido | funcional | integración | Sí | S1 | M |
| PF-M1-02.3 | HU-02 | Invitación vencida | negativo | integración | Sí | S1 | M |
| PF-M1-02.4 | HU-02 | Usuario que ya pertenece a otro hogar | negativo | integración | Sí | S1 | M |
| PF-M1-03.1 | HU-03 | Agregar un comensal con el factor sugerido | funcional | E2E | Sí | S1 | M |
| PF-M1-03.2 | HU-03 | Quitar un comensal | funcional | integración | Sí | S1 | M |
| PF-M1-03.3 | HU-03 | Nombre repetido | negativo | integración | Sí | S1 | M |
| PF-M1-03.4 | HU-03 | Un miembro no puede modificar comensales | negativo | integración | Sí | S1 | M |
| PF-M1-03.5 | HU-03 | Comensal pequeño con factor 0.5 | funcional | integración | Sí | S1 | M |
| PF-M1-03.6 | HU-03 | Factor fuera de rango o fuera de paso | límite | integración | Sí | S1 | M |
| PF-M1-04.1 | HU-04 | Restablecer contraseña con enlace vigente | funcional | E2E | Sí | S1 | S |
| PF-M1-04.2 | HU-04 | Correo no registrado | funcional | integración | Sí | S1 | S |
| PF-M1-04.3 | HU-04 | Enlace vencido | negativo | integración | Sí | S1 | S |

### M02 — Configuración (25 casos, 13 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M2-05.1 | HU-05 | Cambiar de solo almuerzo a almuerzo y cena | funcional | E2E | Sí | S1 | M |
| PF-M2-05.2 | HU-05 | Elegir desayuno y almuerzo | funcional | integración | Sí | S1 | M |
| PF-M2-05.3 | HU-05 | Opción dos tiempos con un solo tiempo marcado | negativo | integración | Sí | S1 | M |
| PF-M2-05.4 | HU-05 | Un miembro no puede cambiar los tiempos | negativo | integración | Sí | S1 | M |
| PF-M2-06.1 | HU-06 | Distribución por porcentaje con tres tiempos | funcional | E2E | Sí | S1 | M |
| PF-M2-06.2 | HU-06 | Distribución por monto con almuerzo y cena | funcional | integración | Sí | S1 | M |
| PF-M2-06.3 | HU-06 | Porcentajes que no suman 100 % | límite | integración | Sí | S1 | M |
| PF-M2-06.4 | HU-06 | Montos que exceden el presupuesto | límite | integración | Sí | S1 | M |
| PF-M2-07.1 | HU-07 | Vista previa al pasar de dos a tres tiempos | funcional | unitaria | Sí | S1 | M |
| PF-M2-07.2 | HU-07 | Confirmar con un menú aprobado en la semana siguiente | funcional | unitaria | Sí | S1 | M |
| PF-M2-07.3 | HU-07 | Cancelar desde la vista previa | funcional | unitaria | Sí | S1 | M |
| PF-M2-07.4 | HU-07 | Borrador futuro queda desactualizado | funcional | unitaria | Sí | S1 | M |
| PF-M2-07.5 | HU-07 | Ajuste en vista previa que no suma 100 % | negativo | unitaria | Sí | S1 | M |
| PF-M2-08.1 | HU-08 | Hogar nuevo usa domingo | funcional | E2E | Sí | S1 | S |
| PF-M2-08.2 | HU-08 | Cambiar inicio a lunes con un menú aprobado | límite | integración | Sí | S1 | S |
| PF-M2-08.3 | HU-08 | Cambiar el día de planificación a sábado | funcional | integración | Parcial | S1 | S |
| PF-M2-08.4 | HU-08 | Un miembro no puede cambiar la semana | negativo | integración | Sí | S1 | S |
| PF-M2-09.1 | HU-09 | La sugerencia de compra respeta los supermercados preferidos | funcional | E2E | Sí | S5 | S |
| PF-M2-09.2 | HU-09 | Elegir marca preferida de aceite | funcional | integración | Sí | S5 | S |
| PF-M2-09.3 | HU-09 | Desmarcar todos los supermercados | negativo | integración | Sí | S5 | S |
| PF-M2-09.4 | HU-09 | Marca preferida con precio antiguo | negativo | integración | Sí | S5 | S |
| PF-M2-10.1 | HU-10 | Excluir un ingrediente | funcional | E2E | Sí | S3 | S |
| PF-M2-10.2 | HU-10 | Marcar platillos favoritos | funcional | integración | Sí | S3 | S |
| PF-M2-10.3 | HU-10 | Favorito con ingrediente excluido | negativo | integración | Sí | S3 | S |
| PF-M2-10.4 | HU-10 | Quitar una exclusión | funcional | integración | Sí | S3 | S |

### M03 — Catálogo de platillos e ingredientes (17 casos, 13 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M3-11.1 | HU-11 | Crear un platillo nuevo | funcional | E2E | Sí | S1 | M |
| PF-M3-11.2 | HU-11 | Inactivar un platillo | funcional | integración | Sí | S1 | M |
| PF-M3-11.3 | HU-11 | Nombre duplicado sin distinguir tildes ni mayúsculas | negativo | integración | Sí | S1 | M |
| PF-M3-11.4 | HU-11 | Platillo sin tiempo de comida | negativo | integración | Sí | S1 | M |
| PF-M3-12.1 | HU-12 | Registrar ingredientes y ver el escalado | funcional | unitaria | Sí | S1 | M |
| PF-M3-12.2 | HU-12 | Crear un producto desde el buscador de ingredientes | funcional | integración | Sí | S1 | M |
| PF-M3-12.3 | HU-12 | Unidad de otra magnitud | negativo | integración | Sí | S1 | M |
| PF-M3-12.4 | HU-12 | Cantidad cero | negativo | integración | Sí | S1 | M |
| PF-M3-12.5 | HU-12 | Vista previa con Σ factores fraccionaria | funcional | unitaria | Sí | S1 | M |
| PF-M3-13.1 | HU-13 | Crear producto de despensa | funcional | E2E | Sí | S1 | M |
| PF-M3-13.2 | HU-13 | Inactivar un producto usado en un platillo | funcional | integración | Sí | S1 | M |
| PF-M3-13.3 | HU-13 | Producto duplicado | negativo | integración | Sí | S1 | M |
| PF-M3-13.4 | HU-13 | Presentación inválida | negativo | integración | Sí | S1 | M |
| PF-M3-14.1 | HU-14 | Calificar un almuerzo ya comido | funcional | E2E | Sí | S3 | S |
| PF-M3-14.2 | HU-14 | Cambiar una calificación | funcional | integración | Sí | S3 | S |
| PF-M3-14.3 | HU-14 | Intentar calificar un día futuro | negativo | integración | Sí | S3 | S |
| PF-M3-14.4 | HU-14 | Valor fuera de rango por API | negativo | integración | Sí | S3 | S |

### M04 — Carga histórica (17 casos, 17 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M4-15.1 | HU-15 | Capturar una semana completa de almuerzos | funcional | E2E | Sí | S2 | M |
| PF-M4-15.2 | HU-15 | Reemplazar una semana ya registrada | funcional | integración | Sí | S2 | M |
| PF-M4-15.3 | HU-15 | Semana que no ha terminado | negativo | integración | Sí | S2 | M |
| PF-M4-15.4 | HU-15 | Gasto negativo | negativo | integración | Sí | S2 | M |
| PF-M4-16.1 | HU-16 | Importar tres semanas válidas | funcional | E2E | Sí | S2 | M |
| PF-M4-16.2 | HU-16 | Omitir una semana que ya existe | negativo | integración | Sí | S2 | M |
| PF-M4-16.3 | HU-16 | Filas con errores bloquean la importación | negativo | integración | Sí | S2 | M |
| PF-M4-16.4 | HU-16 | Falta una columna obligatoria | negativo | integración | Sí | S2 | M |
| PF-M4-16.5 | HU-16 | Gasto inconsistente en la misma semana | negativo | integración | Sí | S2 | M |
| PF-M4-17.1 | HU-17 | Coincidencia exacta tras normalizar | funcional | E2E | Sí | S2 | M |
| PF-M4-17.2 | HU-17 | Asociar a un platillo parecido y recordarlo | funcional | integración | Sí | S2 | M |
| PF-M4-17.3 | HU-17 | Crear un platillo sin parecido | funcional | integración | Sí | S2 | M |
| PF-M4-17.4 | HU-17 | Confirmar con nombres sin resolver | negativo | integración | Sí | S2 | M |
| PF-M4-18.1 | HU-18 | Cargar las 16 semanas del cuaderno | funcional | E2E | Parcial | S2 | M |
| PF-M4-18.2 | HU-18 | Cargar la lista de despensa de Q814 | funcional | E2E | Sí | S2 | M |
| PF-M4-18.3 | HU-18 | Repetir la carga no duplica datos | funcional | integración | Sí | S2 | M |
| PF-M4-18.4 | HU-18 | Conciliación detecta una diferencia | negativo | integración | Parcial | S2 | M |

### M05 — Motor de sugerencias (20 casos, 16 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M5-19.1 | HU-19 | Generar menú con solo almuerzo activo | funcional | E2E | Sí | S3 | M |
| PF-M5-19.2 | HU-19 | Regenerar un borrador de almuerzo y cena conservando un fijado | funcional | integración | Sí | S3 | M |
| PF-M5-19.3 | HU-19 | Faltan platillos de cena | negativo | integración | Sí | S3 | M |
| PF-M5-19.4 | HU-19 | No se regenera una semana aprobada | funcional | integración | Sí | S3 | M |
| PF-M5-20.1 | HU-20 | Puntaje de Pollo en crema | funcional | unitaria | Sí | S3 | M |
| PF-M5-20.2 | HU-20 | Platillo preparado hace una semana y más caro que el presupuesto por comida | funcional | unitaria | Sí | S3 | M |
| PF-M5-20.3 | HU-20 | Pesos que no suman 1.00 | negativo | unitaria | Sí | S3 | M |
| PF-M5-20.4 | HU-20 | Un miembro no puede cambiar los pesos | negativo | unitaria | Sí | S3 | M |
| PF-M5-21.1 | HU-21 | Menú que cumple sin reemplazos | funcional | unitaria | Sí | S3 | M |
| PF-M5-21.2 | HU-21 | Menú excedido que se corrige en 2 intentos | funcional | unitaria | Sí | S3 | M |
| PF-M5-21.3 | HU-21 | Presupuesto insuficiente | negativo | unitaria | Sí | S3 | M |
| PF-M5-21.4 | HU-21 | Tres tiempos con presupuesto por tiempo | funcional | unitaria | Sí | S3 | M |
| PF-M5-22.1 | HU-22 | Ver factores de Pollo en crema | funcional | E2E | Sí | S3 | S |
| PF-M5-22.2 | HU-22 | Platillo cambiado por el usuario | funcional | integración | Sí | S3 | S |
| PF-M5-22.3 | HU-22 | La explicación conserva los pesos usados | funcional | integración | Sí | S3 | S |
| PF-M5-22.4 | HU-22 | Motivo de un reemplazo | funcional | integración | Sí | S3 | S |
| PF-M5-23.1 | HU-23 | Cambiar solo el martes | funcional | E2E | Sí | S3 | M |
| PF-M5-23.2 | HU-23 | La alternativa supera el presupuesto | funcional | integración | Sí | S3 | M |
| PF-M5-23.3 | HU-23 | Se agotan los candidatos | negativo | integración | Sí | S3 | M |
| PF-M5-23.4 | HU-23 | No se ofrece alternativa en un día fijado | funcional | integración | Sí | S3 | M |

### M06 — Plan semanal (16 casos, 12 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M6-24.1 | HU-24 | Intercambiar lunes y jueves | funcional | E2E | Sí | S3 | M |
| PF-M6-24.2 | HU-24 | Elegir un platillo manualmente | funcional | integración | Sí | S3 | M |
| PF-M6-24.3 | HU-24 | Mover un platillo a un tiempo no aplicable | negativo | integración | Sí | S3 | M |
| PF-M6-24.4 | HU-24 | No se edita un menú aprobado | funcional | integración | Sí | S3 | M |
| PF-M6-25.1 | HU-25 | Aprobar un menú dentro del presupuesto | funcional | E2E | Sí | S3 | M |
| PF-M6-25.2 | HU-25 | Aprobar con presupuesto excedido | funcional | integración | Sí | S3 | M |
| PF-M6-25.3 | HU-25 | No se aprueba con espacios vacíos | negativo | integración | Sí | S3 | M |
| PF-M6-25.4 | HU-25 | Se revierte la aprobación si falla la lista | negativo | integración | Sí | S3 | M |
| PF-M6-26.1 | HU-26 | Costo semanal dentro del presupuesto | funcional | E2E | Sí | S3 | M |
| PF-M6-26.2 | HU-26 | Total dentro pero almuerzo excedido | funcional | integración | Sí | S3 | M |
| PF-M6-26.3 | HU-26 | Ingrediente sin precio | negativo | integración | Sí | S3 | M |
| PF-M6-26.4 | HU-26 | El costo se actualiza al cambiar un platillo | funcional | integración | Sí | S3 | M |
| PF-M6-27.1 | HU-27 | Registrar el gasto de la semana | funcional | E2E | Sí | S4 | S |
| PF-M6-27.2 | HU-27 | Corregir un gasto ya registrado | funcional | integración | Sí | S4 | S |
| PF-M6-27.3 | HU-27 | Montos inválidos | límite | integración | Sí | S4 | S |
| PF-M6-27.4 | HU-27 | No se registra gasto en un borrador | funcional | integración | Sí | S4 | S |

### M07 — Lista de compras (33 casos, 26 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M7-28.1 | HU-28 | Pollo usado en dos platillos para 6 comensales | funcional | unitaria | Sí | S4 | M |
| PF-M7-28.2 | HU-28 | Tomate en gramos se convierte a libras | funcional | unitaria | Sí | S4 | M |
| PF-M7-28.3 | HU-28 | Unidad de receta sin equivalencia | negativo | unitaria | Sí | S4 | M |
| PF-M7-28.4 | HU-28 | Intentar generar la lista de un menú no aprobado | negativo | integración | Sí | S4 | M |
| PF-M7-28.5 | HU-28 | Hogar con un comensal de factor 0.5 | funcional | unitaria | Sí | S4 | M |
| PF-M7-28.6 | HU-28 | La lista muestra el exceso aprobado | funcional | integración | Sí | S4 | M |
| PF-M7-29.1 | HU-29 | Solo se agregan los productos que tocan | funcional | E2E | Sí | S4 | M |
| PF-M7-29.2 | HU-29 | Aceite requerido por un platillo y por la despensa | funcional | integración | Sí | S4 | M |
| PF-M7-29.3 | HU-29 | Producto sin inclusión previa | funcional | integración | Sí | S4 | M |
| PF-M7-29.4 | HU-29 | Cantidad inválida | negativo | integración | Sí | S4 | M |
| PF-M7-30.1 | HU-30 | Marcar un producto como comprado | funcional | E2E | Sí | S4 | M |
| PF-M7-30.2 | HU-30 | Cambios en modo avión se sincronizan al reconectar | funcional | E2E | Sí | S4 | M |
| PF-M7-30.3 | HU-30 | Producto eliminado en un dispositivo y comprado en otro | negativo | E2E | Sí | S4 | M |
| PF-M7-30.4 | HU-30 | Agregar producto con cantidad inválida | negativo | integración | Sí | S4 | M |
| PF-M7-31.1 | HU-31 | Productos asignados al supermercado más barato | funcional | E2E | Sí | S5 | S |
| PF-M7-31.2 | HU-31 | Último precio con más de 14 días | límite | integración | Sí | S5 | S |
| PF-M7-31.3 | HU-31 | Mismo precio en dos supermercados | límite | unitaria | Sí | S5 | S |
| PF-M7-31.4 | HU-31 | Producto sin ningún precio registrado | negativo | integración | Sí | S5 | S |
| PF-M7-32.1 | HU-32 | Compartir pendientes por WhatsApp | funcional | E2E | Sí | S4 | C |
| PF-M7-32.2 | HU-32 | Navegador de escritorio sin compartir nativo | funcional | E2E | Parcial | S4 | C |
| PF-M7-32.3 | HU-32 | Todos los productos comprados | negativo | E2E | Sí | S4 | C |
| PF-M7-43.1 | HU-43 | Avance parcial de una comida | funcional | E2E | Sí | S4 | M |
| PF-M7-43.2 | HU-43 | Marcar Ya lo tengo cuenta como cubierto | funcional | integración | Sí | S4 | M |
| PF-M7-43.3 | HU-43 | Un producto compartido cuenta para todas sus comidas | funcional | integración | Sí | S4 | M |
| PF-M7-43.4 | HU-43 | Avance general con porcentaje redondeado | funcional | integración | Sí | S4 | M |
| PF-M7-43.5 | HU-43 | El avance se actualiza en modo avión | funcional | E2E | Sí | S4 | M |
| PF-M7-43.6 | HU-43 | Desmarcar un ingrediente de una comida lista | negativo | integración | Sí | S4 | M |
| PF-M7-44.1 | HU-44 | Registrar precio y recalcular el promedio de 12 semanas | funcional | E2E | Sí | S4 | M |
| PF-M7-44.2 | HU-44 | Normalizar el precio de una presentación distinta | funcional | integración | Sí | S4 | M |
| PF-M7-44.3 | HU-44 | La suma de precios reales prellena el gasto de la semana | funcional | integración | Sí | S4 | M |
| PF-M7-44.4 | HU-44 | El promedio de compra respalda el costo estimado | funcional | integración | Sí | S4 | M |
| PF-M7-44.5 | HU-44 | Precio inválido | límite | integración | Sí | S4 | M |
| PF-M7-44.6 | HU-44 | Precio registrado en modo avión | funcional | E2E | Sí | S4 | M |

### M08 — Precios (26 casos, 22 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M8-33.1 | HU-33 | Corrida del sábado | funcional | E2E | Sí | S5 | M |
| PF-M8-33.2 | HU-33 | Respeto de 1 solicitud por segundo | límite | integración | Sí | S5 | M |
| PF-M8-33.3 | HU-33 | Paiz prohíbe la ruta de productos | negativo | integración | Sí | S5 | M |
| PF-M8-33.4 | HU-33 | Sitio no habilitado | funcional | integración | Sí | S5 | M |
| PF-M8-33.5 | HU-33 | Disparo con corrida anterior sin terminar | negativo | integración | Sí | S5 | M |
| PF-M8-34.1 | HU-34 | Registrar precio de Super Fresh | funcional | E2E | Sí | S5 | M |
| PF-M8-34.2 | HU-34 | Ticket con tres líneas | funcional | E2E | Parcial | S5 | M |
| PF-M8-34.3 | HU-34 | OCR sin líneas legibles | negativo | integración | Parcial | S5 | M |
| PF-M8-34.4 | HU-34 | Datos inválidos | límite | integración | Sí | S5 | M |
| PF-M8-35.1 | HU-35 | Vincular con la misma presentación | funcional | E2E | Sí | S5 | M |
| PF-M8-35.2 | HU-35 | Paiz solo vende bolsa de 5 lb | funcional | integración | Sí | S5 | M |
| PF-M8-35.3 | HU-35 | Reemplazar vínculo activo | funcional | integración | Sí | S5 | M |
| PF-M8-35.4 | HU-35 | Unidad no convertible | negativo | integración | Sí | S5 | M |
| PF-M8-36.1 | HU-36 | Arroz con tres precios | límite | unitaria | Sí | S5 | M |
| PF-M8-36.2 | HU-36 | Pollo con cuatro precios | límite | unitaria | Sí | S5 | M |
| PF-M8-36.3 | HU-36 | Aceite con dos precios | límite | unitaria | Sí | S5 | M |
| PF-M8-36.4 | HU-36 | Precio antiguo excluido | límite | unitaria | Sí | S5 | M |
| PF-M8-36.5 | HU-36 | Mínimo empatado | límite | unitaria | Sí | S5 | M |
| PF-M8-37.1 | HU-37 | Pollo sube en Walmart | funcional | E2E | Sí | S5 | S |
| PF-M8-37.2 | HU-37 | Tomate baja en Paiz | funcional | integración | Sí | S5 | S |
| PF-M8-37.3 | HU-37 | Supermercado con un solo precio | límite | integración | Sí | S5 | S |
| PF-M8-37.4 | HU-37 | Precios manuales de otro hogar no se muestran | negativo | integración | Sí | S5 | S |
| PF-M8-38.1 | HU-38 | Paiz no responde para un producto | funcional | E2E | Sí | S5 | M |
| PF-M8-38.2 | HU-38 | Paiz cambió su página | negativo | integración | Sí | S5 | M |
| PF-M8-38.3 | HU-38 | Precio no interpretable | negativo | integración | Sí | S5 | M |
| PF-M8-38.4 | HU-38 | Precio conservado desactualizado | límite | integración | Sí | S5 | M |

### M09 — Reportes (7 casos, 0 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M9-39.1 | HU-39 | Ver diferencias de una semana excedida | funcional | E2E | Sí | S6 | S |
| PF-M9-39.2 | HU-39 | Semana sin gasto real y hogar con pocas semanas | funcional | integración | Sí | S6 | S |
| PF-M9-39.3 | HU-39 | Aislamiento de datos entre hogares | negativo | integración | Sí | S6 | S |
| PF-M9-39.4 | HU-39 | Hogar sin semanas registradas | negativo | integración | Sí | S6 | S |
| PF-M9-40.1 | HU-40 | Ver los platillos más frecuentes | funcional | E2E | Sí | S6 | C |
| PF-M9-40.2 | HU-40 | Platillos no preparados en más de 4 semanas | funcional | integración | Sí | S6 | C |
| PF-M9-40.3 | HU-40 | Límite exacto de 4 semanas y platillo inactivo | límite | integración | Sí | S6 | C |

### M10 — Notificaciones (8 casos, 0 @regresion)

| PF | HU | Escenario | Tipo | Nivel | Automatizable | Sprint | Prioridad |
|---|---|---|---|---|---|---|---|
| PF-M10-41.1 | HU-41 | Recordatorio el domingo con borrador listo | funcional | E2E | Parcial | S6 | S |
| PF-M10-41.2 | HU-41 | Día de planificación cambiado a sábado y sin borrador | funcional | integración | Parcial | S6 | S |
| PF-M10-41.3 | HU-41 | Menú ya aprobado | funcional | integración | Parcial | S6 | S |
| PF-M10-41.4 | HU-41 | Token de Android inválido y reintento del job | negativo | integración | Parcial | S6 | S |
| PF-M10-42.1 | HU-42 | Edición que supera el umbral | límite | E2E | Sí | S6 | S |
| PF-M10-42.2 | HU-42 | Subida de precios del worker sin alertas duplicadas | negativo | integración | Sí | S6 | S |
| PF-M10-42.3 | HU-42 | Exactamente 10 % no alerta | límite | integración | Sí | S6 | S |
| PF-M10-42.4 | HU-42 | Nueva alerta tras volver bajo el umbral | límite | integración | Parcial | S6 | S |
