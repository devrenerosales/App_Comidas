# Cómo contribuir — Menú Familiar

## Flujo de ramas

| Rama | Uso |
|---|---|
| `main` | Versiones aprobadas por el Product Owner. Cada versión se etiqueta `vX.Y.Z` y publica imágenes en GHCR. |
| `develop` | Integración del sprint en curso. |
| `feature/HU-nn-descripcion` | Una rama por historia de usuario, creada desde `develop`. Ej.: `feature/HU-19-propuesta-semanal`. |
| `fix/DEF-nn-descripcion` | Corrección de un defecto reportado. |

1. `git switch develop && git pull`
2. `git switch -c feature/HU-19-propuesta-semanal`
3. Programa con pruebas; verifica en local (ver abajo).
4. Prepara el commit y abre un Pull Request hacia `develop` con la plantilla (HU, tipo, checklist DoD).
5. Al cierre del sprint, `develop` se fusiona en `main` y se crea la etiqueta `vX.Y.Z`.

> **Importante (R-04):** Claude y el equipo preparan los cambios y el mensaje de commit, pero **el Product Owner es quien ejecuta `git push`** (ramas y etiquetas).

## Mensajes de commit

[Conventional Commits](https://www.conventionalcommits.org/es/) citando la historia:

```
feat(menu): genera propuesta semanal (HU-19)
fix(lista): corrige suma de cantidades por comensal (DEF-04)
test(precios): agrega casos de mediana (HU-36)
docs(manual): sección de lista de compras (HU-27)
chore(deps): actualiza NestJS a 10.4.6
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `build`. Ámbitos sugeridos: `api`, `web`, `worker`, `shared`, `menu`, `lista`, `precios`, `config`, `catalogo`, `reportes`, `notif`.

## Cómo correr en local

Requisitos: Node 20 LTS (`nvm use`), pnpm 9.12.0 (`corepack enable`), Docker (para PostgreSQL y Redis).

```bash
corepack enable                          # activa pnpm 9.12.0 según package.json
cp .env.example .env                     # y completa secretos
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL 16 + Redis 7
pnpm install
pnpm db:migrate                          # aplica las migraciones a DATABASE_URL (.env)
pnpm db:seed                             # supermercados, unidades y categorías (idempotente)
pnpm dev                                 # api :3000, web :5173, worker
```

Antes de abrir el PR:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Base de datos (Drizzle ORM, ADR-010)

El esquema vive en `packages/db/src/schema/*.ts` (fuente de verdad) y las migraciones SQL en `packages/db/drizzle/`.

| Tarea | Comando |
|---|---|
| Aplicar migraciones pendientes | `pnpm db:migrate` |
| Cargar la semilla | `pnpm db:seed` (`SEED_ADMIN_SISTEMA_CORREO` marca al administrador del sistema) |
| Cambiar el esquema | Edite `packages/db/src/schema/<dominio>.ts` y ejecute `pnpm --filter @menu/db db:generate --name=hu35_vinculo_sku`; revise y versione el SQL generado |
| SQL que el esquema no declara (CHECK, índices parciales, datos) | `pnpm --filter @menu/db db:generate --custom --name=<descripcion>` y escriba el SQL |
| Explorar datos | `pnpm db:studio` |

- Nunca edite una migración ya fusionada en `develop`/`main`, ni use `drizzle-kit push` (borraría las reglas de `0002_reglas_integridad`).
- CI falla si el esquema cambió sin su migración.
- **Pruebas de integración contra PostgreSQL real:** defina `TEST_DATABASE_URL` (usuario con permiso `CREATEDB`); cada suite crea y elimina su propia base. Sin la variable esas suites se omiten.

```bash
# Con el PostgreSQL de docker-compose.dev.yml:
export TEST_DATABASE_URL=postgresql://menu:cambiar-esta-clave@localhost:5432/menu_familiar
pnpm test
```

En la API use `test/utils/base-datos.ts`: `describeConBd`, `usarBaseDePruebas({ suite, sembrar, truncarEntrePruebas })`, `crearAppConBd(base)` y `enTransaccionRevertida(db, fn)`.

## Estándares

- TypeScript estricto en todo el monorepo; sin `any` salvo justificación.
- Lógica de negocio pura (reglas RN-xx) en `packages/shared` con pruebas al 100 %.
- Cobertura mínima de 70 % por módulo (RNF-09).
- Textos de interfaz en español (es-GT), moneda en quetzales (Q), zona horaria America/Guatemala.
- Nunca subir `.env`, fotos del cuaderno (`imagenes/`) ni datos personales.
- El worker de precios respeta robots.txt, términos de uso y máximo 1 solicitud/s por sitio (RNF-12); cada sitio está apagado hasta que el PO lo autorice.
