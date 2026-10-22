# syntax=docker/dockerfile:1.7
# Worker de precios (BullMQ + Playwright). Contexto de build: raíz del repositorio.
#   docker build -f apps/worker/Dockerfile -t menu-worker .
# Sprint 0: sin navegadores. Cuando HU-33 active la extracción, construir con
#   --build-arg INSTALL_BROWSERS=true
# Multi-arquitectura (linux/amd64 y linux/arm64 para Oracle Ampere A1, ADR-009):
# Debian bookworm + Node oficiales son multi-arch y Playwright publica Chromium para Linux arm64.
ARG NODE_VERSION=20.18.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@menu/worker...
RUN pnpm --filter @menu/worker deploy --prod /out

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG INSTALL_BROWSERS=false
ENV NODE_ENV=production TZ=America/Guatemala PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=build /out ./
# procps aporta pgrep para el healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends tini tzdata procps \
 && if [ "$INSTALL_BROWSERS" = "true" ]; then npx --no-install playwright install --with-deps chromium; fi \
 && rm -rf /var/lib/apt/lists/* \
 && chown -R node:node /app
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD pgrep -f "node dist/main.js" >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
