# Sprint 1 — Hogar, configuración y catálogo

| Campo | Valor |
|---|---|
| Fechas planificadas | 2026-10-26 → 2026-11-06 (se adelantó el inicio al 2026-10-22) |
| Objetivo | El administrador crea su hogar con comensales y factores de porción, configura tiempos y presupuesto con vista previa, y registra platillos con ingredientes del catálogo |
| Estado | Historias terminadas e integradas en `develop`; pendiente la revisión del PO y el despliegue en Oracle Cloud |

## 1. Historias

| HU | Historia | Puntos | Rama | Estado |
|---|---|---|---|---|
| HU-01 | Registro e inicio de sesión | 5 | `feature/HU-01-registro-login` | Terminada |
| HU-02 | Crear hogar e invitar | 8 | `feature/HU-02-hogar-invitaciones` | Terminada |
| HU-03 | Comensales con factor de porción | 5 | `feature/HU-03-comensales` | Terminada |
| HU-05 | Tiempos de comida parametrizables | 5 | `feature/HU-05-07-configuracion` | Terminada |
| HU-06 | Presupuesto y distribución | 5 | `feature/HU-05-07-configuracion` | Terminada |
| HU-07 | Recálculo con vista previa | 8 | `feature/HU-05-07-configuracion` | Terminada |
| HU-13 | Catálogo de productos | 5 | `feature/HU-11-13-catalogo-platillos` | Terminada |
| HU-11 | Gestionar platillos | 5 | `feature/HU-11-13-catalogo-platillos` | Terminada |
| HU-12 | Ingredientes por porciones base | 5 | `feature/HU-11-13-catalogo-platillos` | Terminada |
| | **Total** | **51** | | **51 de 51 puntos** |

Tareas técnicas: cambio de Prisma a Drizzle (ADR-010) con pruebas contra PostgreSQL real, despliegue en Oracle Cloud ARM documentado (ADR-009), CI con servicio PostgreSQL y semilla de 45 productos.

## 2. Verificación en `develop` integrado

| Paquete | Pruebas | Resultado |
|---|---|---|
| api (unitarias) | 209 | Pasan |
| api (integración con PostgreSQL real) | 149 | Pasan |
| web | 149 | Pasan |
| shared | 156 | Pasan |
| db | 174 | Pasan |
| worker | 33 | Pasan |
| **Total** | **870** | **Pasan** |

Lint, revisión de tipos, build, Prettier y `db:generate` (sin cambios de esquema) en verde. Cada criterio CA-01, 02, 03, 05, 06, 07, 11, 12 y 13 tiene pruebas con su ID. La cobertura de cada paquete supera el 70 % (RNF-09).

## 3. Decisiones de implementación a confirmar por el PO

| # | Decisión | Historia |
|---|---|---|
| 1 | El refresh viaja en cookie HttpOnly en la web y en el cuerpo para Android (cabecera `X-Cliente: android`) | HU-01 |
| 2 | Una invitación por correo solo la acepta la cuenta con ese correo; la de enlace, cualquier cuenta sin hogar | HU-02 |
| 3 | La etiqueta adulto/niño del comensal es opcional (por defecto adulto) y no afecta el cálculo | HU-03 |
| 4 | Cualquier miembro puede crear productos en el catálogo común; solo el administrador del sistema los edita o inactiva | HU-13 |
| 5 | En modo "por monto", el reparto se guarda en porcentaje con 2 decimales, así que un monto puede variar un centavo | HU-06 |

## 4. Pendientes que pasan al Sprint 2

- Capturas de pantalla en los capítulos 1 a 4 del manual.
- Pruebas E2E de navegador con Playwright de los escenarios marcados `@e2e`.
- Guardar el refresh de Android en almacenamiento seguro al agregar la plataforma Android.
- Primer despliegue en Oracle Cloud (requiere la VM, DuckDNS y la contraseña de aplicación de Gmail).
