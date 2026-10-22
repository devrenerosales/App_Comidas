# Sprint 0 — Fundaciones · Cierre

| Campo | Valor |
|---|---|
| Fechas | 2026-10-20 al 2026-10-22 |
| Objetivo | Dejar requerimientos aprobados, diseño base, plan de pruebas y repositorio listo para construir el Sprint 1 |
| Resultado | Objetivo cumplido; quedan 5 preguntas de infraestructura (abajo) que no bloquean el Sprint 1 |

## 1. Revisión del sprint (entregables)

| Fase | Entregable | Ubicación | Estado |
|---|---|---|---|
| 1. Planificación | Análisis de la solución | [Análisis y Solución](https://claude.ai/artifact/36mwqadZzC3S6c4bBkiV2M) | Hecho |
| 1. Planificación | Registro de decisiones del PO (D-01 a D-10) | [decisiones-po.md](decisiones-po.md) | Hecho |
| 1. Planificación | Plan de sprints y Sprint 1 | [plan-sprints.md](plan-sprints.md) | Hecho |
| 2. Requerimientos | SRS v1.3 (44 RF, 13 RN, 13 RNF) | [SRS.md](../01-requerimientos/SRS.md) | Aprobado |
| 2. Requerimientos | 44 casos de uso, historias, criterios y subtareas | [historias/](../01-requerimientos/historias/README.md) | Hecho |
| 3. Diseño | Arquitectura C4, despliegue en casa, secuencias técnicas | [02-diseno/](../02-diseno/arquitectura.md) | Hecho |
| 3. Diseño | 8 ADR | [adr/](../02-diseno/adr/README.md) | Propuestos (ver §3) |
| 3. Diseño | Modelo de datos (49 modelos), `schema.prisma`, contrato API | [modelo-datos.md](../02-diseno/modelo-datos.md) · [api-contrato.md](../02-diseno/api-contrato.md) | Hecho |
| 3. Diseño | Prototipo: 7 pantallas nuevas (configuración, comensales, 3 tiempos, importación, precio manual, notificaciones, lista con avance) | [Prototipo](https://claude.ai/artifact/E5BNpQxh3ianZUmYpBmSLz) · [pantallas.md](../02-diseno/pantallas.md) | Hecho |
| 5. Pruebas | Plan de pruebas, 186 casos, 44 features Gherkin, plantillas | [03-pruebas/](../03-pruebas/plan-de-pruebas.md) | Hecho |
| 4. Construcción | Monorepo pnpm + Turborepo: web, api, worker, shared; Docker Compose; CI | raíz del repo | Hecho (lint, typecheck, pruebas y build en verde) |
| 7. Usuario | Estructura del manual de usuario | [05-manual-usuario/](../05-manual-usuario/README.md) | Esqueleto |

## 2. Retrospectiva

| Qué funcionó | Qué mejorar | Acción |
|---|---|---|
| Decidir los supuestos con preguntas cerradas aceleró el diseño | Algunas historias se escribieron antes de las decisiones y hubo que corregirlas (D-02, D-03) | Validar supuestos con el PO antes de detallar historias |
| Diagramas Mermaid validados automáticamente | El entorno de Claude no descarga motores de Prisma ni tiene Docker | Validar migraciones e imágenes Docker en la primera corrida de CI en GitHub |
| Trazabilidad RF → CU → HU → CA → PF completa | La estimación en horas no refleja que Claude genera buena parte del código | Medir la velocidad real en puntos durante el Sprint 1 y replanificar |

## 3. Pendientes del PO

| ID | Pregunta | Recomendación | Bloquea |
|---|---|---|---|
| PO-01 | ¿Dominio propio (~US$10/año) para Cloudflare Tunnel o Tailscale solo para la familia? | Dominio: lo necesitan Web Push, Android y el correo | Despliegue (S1 fin) |
| PO-02 | ¿Equipo servidor: mini PC N100 nuevo o una laptop existente? | Mini PC con SSD y 8 GB RAM | Despliegue |
| PO-03 | ¿Correo para invitaciones y recuperación: Gmail con contraseña de aplicación o Brevo/Resend? | Brevo/Resend con el dominio de PO-01 | HU-02, HU-04 |
| PO-04 | ¿Respaldo fuera de casa: Backblaze B2, Cloudflare R2, Google Drive o solo disco USB? | Backblaze B2 o R2 (centavos al mes) | RNF-11 (S1–S2) |
| PO-05 | ¿Monitor externo UptimeRobot gratis para medir el 95 %? | Sí | RNF-03 |
| PO-06 | Aprobar ADR-004 (token de 15 min + refresh rotativo de 30 días), ADR-005 (último cambio gana con hora del dispositivo corregida) y OCR de tickets con tesseract.js en el worker | Aprobar | HU-01, HU-30, HU-34 |

## 4. Validaciones técnicas pendientes en GitHub

- Primera corrida de CI: `prisma generate` y migración inicial contra PostgreSQL real.
- Construcción de las imágenes Docker (`release.yml`).
- La prueba e2e de salud que se omitió en el entorno de Claude por no poder generar el cliente de Prisma.
