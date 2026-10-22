# syntax=docker/dockerfile:1.7
# API NestJS — imagen multi-stage. Contexto de build: raíz del repositorio.
#   docker build -f apps/api/Dockerfile -t menu-api .
ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN apk add --no-cache libc6-compat \
 && corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# 1) Dependencias + build del paquete y sus dependencias del workspace
FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@menu/api...
# 2) Árbol de producción aislado (sin devDependencies). Incluye @menu/db con dist/ y las
#    migraciones SQL (drizzle/): Drizzle es TypeScript puro, sin motores binarios (ADR-010).
RUN pnpm --filter @menu/api deploy --prod /out

# 3) Imagen final mínima
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache tini tzdata
ENV NODE_ENV=production TZ=America/Guatemala PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Migraciones: `npm run db:migrate` (solo hacia adelante, con candado consultivo) antes de
# `up`, p. ej. `docker compose run --rm api npm run db:migrate`. Semilla: `npm run db:seed`.
CMD ["node", "dist/main.js"]
