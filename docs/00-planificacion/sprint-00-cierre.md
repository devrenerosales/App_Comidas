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
| 3. Diseño | Arquitectura C4, despliegue (v1 en casa; reemplazado por Oracle Cloud, ADR-009), secuencias técnicas | [02-diseno/](../02-diseno/arquitectura.md) | Hecho |
| 3. Diseño | 10 ADR (ADR-009 Oracle Cloud y ADR-010 Drizzle agregados el 2026-10-22) | [adr/](../02-diseno/adr/README.md) | Aceptados; ADR-005 propuesto y ADR-002 reemplazado (ver §3) |
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

| ID | Pregunta | Recomendación | Bloquea | Estado |
|---|---|---|---|---|
| PO-01 | ~~¿Dominio propio (~US$10/año) para Cloudflare Tunnel o Tailscale solo para la familia?~~ | Dominio: lo necesitan Web Push, Android y el correo | Despliegue (S1 fin) | **Resuelta (D-12)**: subdominio gratis DuckDNS con HTTPS de Caddy + Let's Encrypt (ADR-009) |
| PO-02 | ~~¿Equipo servidor: mini PC N100 nuevo o una laptop existente?~~ | Mini PC con SSD y 8 GB RAM | Despliegue | **Resuelta (D-11)**: producción en Oracle Cloud Always Free ARM; la laptop queda para desarrollo (ADR-009) |
| PO-03 | ~~¿Correo para invitaciones y recuperación: Gmail con contraseña de aplicación o Brevo/Resend?~~ | Brevo/Resend con el dominio de PO-01 | HU-02, HU-04 | **Resuelta (D-13)**: Gmail SMTP con contraseña de aplicación |
| PO-04 | ¿Respaldo fuera de la VM: Object Storage de OCI (20 GB gratis), la laptop vía rsync o ambos? | Ambos | RNF-11 (S1–S2) | Abierta (replanteada por D-11) |
| PO-05 | ¿Monitor externo UptimeRobot gratis para medir el 99 %? | Sí | RNF-03 | Abierta |
| PO-06 | Aprobar ~~ADR-004 (token de 15 min + refresh rotativo de 30 días)~~, ADR-005 (último cambio gana con hora del dispositivo corregida) y OCR de tickets con tesseract.js en el worker | Aprobar | HU-01, HU-30, HU-34 | ADR-004 **resuelta (D-14)**; ADR-005 y OCR abiertas |
| PO-07 | ¿Pasar la cuenta de OCI a Pay As You Go (con presupuesto y alerta a US$1) para evitar el reclamo de instancias Always Free inactivas? | Sí | Despliegue | Abierta |
| PO-08 | ¿Paquetes de GHCR públicos o privados (token `read:packages` en la VM)? | Privados si el repositorio es privado | Despliegue | Abierta |

## 4. Validaciones técnicas pendientes en GitHub

- Primera corrida de CI: migración inicial con Drizzle ORM (D-15, ADR-010) contra PostgreSQL real.
- Construcción de las imágenes Docker multi-arquitectura `linux/amd64` + `linux/arm64` (`release.yml`, ADR-009).
- La prueba e2e de salud que se omitió en el entorno de Claude por no poder generar el cliente de Prisma (con Drizzle, D-15, ya no depende de motores binarios).
