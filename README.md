# Menú Familiar (App_Comidas)

Aplicación web (PWA) y Android que sugiere el menú semanal de la familia según historial, preferencias y presupuesto, genera la lista de compras (ingredientes + despensa) y compara precios de La Torre, Paiz, Walmart y Super Fresh.

**Stack:** React + Ionic + Capacitor · NestJS · PostgreSQL + Prisma · BullMQ/Redis · Playwright · Docker · GitHub Actions.

## Estado

| Fase del ciclo de vida | Estado |
|---|---|
| 1. Planificación | Sprint 0 cerrado · [plan de sprints](docs/00-planificacion/plan-sprints.md) · [decisiones del PO](docs/00-planificacion/decisiones-po.md) |
| 2. Requerimientos | SRS v1.3 aprobado · 44 casos de uso e historias |
| 3. Diseño | Arquitectura, 8 ADR, modelo de datos, contrato API, [prototipo](https://claude.ai/artifact/E5BNpQxh3ianZUmYpBmSLz) |
| 4. Construcción | Base técnica lista · Sprint 1 inicia 2026-10-26 |
| 5. Pruebas | Plan de pruebas · 186 casos · 44 features Gherkin |

## Documentación

| Fase | Carpeta |
|---|---|
| Planificación | [`docs/00-planificacion/`](docs/00-planificacion/sprint-00-cierre.md) |
| Requerimientos | [`docs/01-requerimientos/`](docs/01-requerimientos/SRS.md) · [historias](docs/01-requerimientos/historias/README.md) |
| Diseño | [`docs/02-diseno/`](docs/02-diseno/arquitectura.md) |
| Pruebas | [`docs/03-pruebas/`](docs/03-pruebas/plan-de-pruebas.md) |
| Despliegue | [`docs/02-diseno/despliegue.md`](docs/02-diseno/despliegue.md) |
| Manual de usuario | [`docs/05-manual-usuario/`](docs/05-manual-usuario/README.md) |

## Flujo de ramas

- `main`: versiones aprobadas por el Product Owner.
- `develop`: integración del sprint en curso.
- `feature/HU-nn-descripcion`: una rama por historia de usuario.

Mensajes de commit con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat`, `fix`, `docs`, `test`, `chore`) citando la historia: `feat(menu): genera propuesta semanal (HU-19)`.

## Desarrollo local

### Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 20 LTS (ver `.nvmrc`) |
| pnpm | 9.12.0 (`corepack enable`) |
| Docker + Docker Compose | 24+ (PostgreSQL 16 y Redis 7) |
| Android Studio + SDK | Solo para compilar la app Android (sprint de empaquetado) |

### Estructura del monorepo

| Paquete | Descripción |
|---|---|
| `apps/api` | API REST NestJS 10 (`/api/v1`), Prisma, health check |
| `apps/worker` | Worker de precios: BullMQ (cola `precios`) + Playwright |
| `apps/web` | App Ionic React 8 + Vite, PWA y Capacitor 6 |
| `packages/shared` | Tipos, enums y reglas de negocio puras (p. ej. RN-06) |

### Primeros pasos

```bash
corepack enable
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL + Redis
pnpm install
pnpm --filter @menu/api prisma:generate
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1/health

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Levanta api, worker y web en modo desarrollo |
| `pnpm build` | Compila todos los paquetes (Turborepo) |
| `pnpm lint` | ESLint en todo el monorepo |
| `pnpm typecheck` | Verificación de tipos TypeScript |
| `pnpm test` | Pruebas (Vitest / Jest + Supertest) con cobertura |
| `pnpm format` | Formatea con Prettier |
| `pnpm --filter @menu/api test:e2e` | Solo pruebas e2e de la API |
| `docker compose up -d` | Producción en casa (web, api, worker, postgres, redis) |
| `docker compose --profile tunnel up -d` | Igual, más túnel HTTPS de Cloudflare (`TUNNEL_TOKEN`) |

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de ramas y commits.
