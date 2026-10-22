# ADR-010 — Drizzle ORM en lugar de Prisma

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

Decisión del PO: **D-15**. Reemplaza la fila "Persistencia" de [ADR-001](ADR-001-stack.md) (Prisma 5); el resto de ADR-001 sigue vigente.

## Contexto
- ADR-001 fijó PostgreSQL 16 + Prisma 5.22. Prisma necesita **motores binarios** (query engine y schema engine) que se descargan de `binaries.prisma.sh` al instalar o al ejecutar `prisma generate`.
- Ni el entorno de Claude ni la laptop del PO pueden descargar esos binarios (red con lista de dominios permitidos). En el Sprint 0 eso dejó sin probar la migración inicial y obligó a omitir la prueba e2e de salud contra la base ([sprint-00-cierre.md](../../00-planificacion/sprint-00-cierre.md)).
- El plan de pruebas exige **pruebas de integración contra PostgreSQL real** en cada PR (RNF-09, aislamiento RNF-06), en CI y en local, desde el Sprint 1.
- El modelo ya estaba diseñado: 49 modelos y 35 enums ([historico/schema.prisma](../historico/schema.prisma)) más reglas que Prisma no expresa (CHECK, índices parciales, `pg_trgm`).
- La imagen de la API corre en Alpine (musl) y en ARM (Oracle Cloud, ADR-009): cada motor binario es una variante más que compilar o descargar.

## Decisión
Usar **Drizzle ORM** (TypeScript puro, sin binarios) con el controlador `pg` (node-postgres).

| Aspecto | Decisión |
|---|---|
| Paquete | `packages/db` (`@menu/db`): esquema, cliente, migraciones, semilla y utilidades de prueba; lo consumen API y worker |
| Fuente de verdad del modelo | `packages/db/src/schema/*.ts`, un archivo por dominio (`hogar-config`, `catalogo-menus`, `compras-despensa`, `precios-notificaciones`) + `enums.ts` |
| Fidelidad | Mismas tablas, columnas, tipos, enums, únicos, índices y FK (ON DELETE) que el diseño; lo verifica `test/fidelidad-prisma.test.ts` contra el `schema.prisma` histórico |
| Migraciones | SQL versionado en `packages/db/drizzle/`, generado con `drizzle-kit generate`; migraciones manuales (`--custom`) para lo que el esquema no declara: `0000_extensiones` (pg_trgm) y `0002_reglas_integridad` (CHECK e índices parciales de modelo-datos.md §6.1) |
| Aplicación | Runner propio (`drizzle-orm/node-postgres/migrator`) con candado consultivo: `pnpm db:migrate` en desarrollo y `npm run db:migrate` dentro de la imagen de la API; solo hacia adelante |
| Semilla | `pnpm db:seed`, idempotente (supermercados con extracción apagada, unidades, categorías) |
| API | `DatabaseModule` global con tokens `PG_POOL` (pool `pg`) y `DB` (cliente Drizzle); cierre ordenado en `onModuleDestroy`; health `select 1` con timeout |
| Pruebas | Base aislada por suite (`crearBaseTemporal`) migrada con las mismas migraciones; `TEST_DATABASE_URL` habilita la integración y su ausencia la omite limpiamente |
| Versiones | `drizzle-orm` 0.45.3, `drizzle-kit` 0.31.11, `pg` 8.23.1, `@types/pg` 8.23.1 (exactas) |

## Alternativas
| Opción | Por qué no |
|---|---|
| Prisma 7 sin motor Rust (cliente TypeScript + driver adapter `@prisma/adapter-pg`) | Elimina el query engine, pero `prisma migrate` y `prisma generate` siguen dependiendo de descargas y de un paso de generación de código; versión mayor reciente con menos recorrido. Mantener Prisma 5 y su `schema.prisma` no resuelve el bloqueo actual |
| Kysely | Constructor de consultas excelente y sin binarios, pero sin esquema declarativo ni generador de migraciones: habría que escribir a mano el SQL de 49 tablas y mantener los tipos por separado |
| TypeORM | Decoradores sobre clases y migraciones con más magia; tipado de consultas más débil, sincronización de esquema riesgosa y mantenimiento irregular |
| SQL puro con `pg` | Máximo control, pero sin tipos inferidos ni consultas relacionales; mucho código repetido en repositorios |

## Consecuencias
- (+) Instalación, generación de migraciones, pruebas e imagen Docker funcionan sin red hacia servidores de Prisma, en x86 y ARM, en Alpine y en CI.
- (+) Pruebas de integración contra PostgreSQL 16 real desde el Sprint 1 (CI con servicio `postgres:16-alpine`).
- (+) Tipos inferidos del propio esquema (`Usuario`, `UsuarioInsert`, …); sin paso de `generate` antes de compilar.
- (+) SQL de migración legible y revisable en el PR; CI falla si el esquema cambia sin migración (`pnpm db:generate` + `git status`).
- (−) Las reglas de §6.1 (CHECK, índices parciales) viven en una migración manual: no aparecen en el snapshot de drizzle-kit. **No se usa `drizzle-kit push`** (intentaría borrarlas); siempre `db:generate` + `db:migrate`.
- (−) Decimales llegan como `string` (sin pérdida de precisión): el cálculo de dinero usa aritmética decimal en el servicio, como ya pedía modelo-datos.md.
- (−) `updated_at` se actualiza en las sentencias `update` de Drizzle (`$onUpdate`), no con un trigger: un `UPDATE` en SQL crudo debe fijarlo explícitamente.
- (−) `pg_trgm` requiere permiso de `CREATE EXTENSION` al migrar (usuario dueño de la base o superusuario en el contenedor de PostgreSQL).
- Documentos afectados: [modelo-datos.md](../modelo-datos.md) (fuente de verdad y estrategia de migraciones), [arquitectura.md](../arquitectura.md), plan de pruebas, CONTRIBUTING y README.
