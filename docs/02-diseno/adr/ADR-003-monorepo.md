# ADR-003 — Monorepo pnpm + Turborepo

| Estado | Fecha | Decisores |
|---|---|---|
| Aceptado | 2026-10-22 | Rene Rosales (PO), Claude (arquitectura) |

## Contexto
Web, API y worker comparten tipos, esquemas de validación, el motor de sugerencias y el esquema Prisma. Cambios que cruzan capas (p. ej. un campo nuevo de la lista) deben ir en un solo commit y probarse juntos en CI.

## Decisión
- Un repositorio con workspaces de **pnpm** y orquestación con **Turborepo** (`build`, `test`, `lint`, `dev` con caché).
- Estructura: `apps/web`, `apps/api`, `apps/worker`, `packages/shared`, `packages/db`, `packages/config`, `infra/`, `docs/`.
- Versiones de dependencias alineadas con `pnpm` catalog; Node 22 fijado en `.nvmrc` y `engines`.
- CI con `turbo run lint test build --filter=...[origin/develop]` para probar solo lo afectado.

## Alternativas
| Opción | Por qué no |
|---|---|
| Repos separados | Sincronizar tipos y versiones entre repos; PR múltiples por cambio |
| Nx | Más potente pero más configuración de la necesaria |
| npm/yarn workspaces sin orquestador | Sin caché ni ejecución por grafo de dependencias |

## Consecuencias
- (+) Un PR por historia con front, back y pruebas; trazabilidad con HU.
- (+) El motor se prueba aislado y lo reutilizan API y, si hace falta, la app.
- (−) Dockerfiles deben usar `turbo prune` para no copiar todo el repo en cada imagen.
- (−) Curva inicial de configuración en S0.
