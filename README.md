# Menú Familiar (App_Comidas)

Aplicación web (PWA) y Android que sugiere el menú semanal de la familia según historial, preferencias y presupuesto, genera la lista de compras (ingredientes + despensa) y compara precios de La Torre, Paiz, Walmart y Super Fresh.

**Stack:** React + Ionic + Capacitor · NestJS · PostgreSQL + Prisma · BullMQ/Redis · Playwright · Docker · GitHub Actions.

## Estado

| Fase del ciclo de vida | Estado |
|---|---|
| 1. Planificación | Análisis de la solución y plan de 7 sprints (S0–S6) |
| 2. Requerimientos | SRS v1.1 aprobado · 42 casos de uso e historias |
| 3. Diseño | Siguiente |

## Documentación

| Fase | Carpeta |
|---|---|
| Planificación | `docs/00-planificacion/` |
| Requerimientos | [`docs/01-requerimientos/`](docs/01-requerimientos/SRS.md) · [historias](docs/01-requerimientos/historias/README.md) |
| Diseño | `docs/02-diseno/` |
| Pruebas | `docs/03-pruebas/` |
| Despliegue | `docs/04-despliegue/` |
| Manual de usuario | `docs/05-manual-usuario/` |

## Flujo de ramas

- `main`: versiones aprobadas por el Product Owner.
- `develop`: integración del sprint en curso.
- `feature/HU-nn-descripcion`: una rama por historia de usuario.

Mensajes de commit con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat`, `fix`, `docs`, `test`, `chore`) citando la historia: `feat(menu): genera propuesta semanal (HU-19)`.
