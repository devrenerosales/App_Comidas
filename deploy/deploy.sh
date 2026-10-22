#!/usr/bin/env bash
# Despliegue / actualización de Menú Familiar en la VM de Oracle Cloud (ADR-009).
#
#   Uso:  ./deploy/deploy.sh [versión]     p. ej. ./deploy/deploy.sh 1.2.0
#         Sin versión usa IMAGE_TAG de .env (o "latest").
#         Revertir: ./deploy/deploy.sh <versión anterior>  (queda en IMAGE_TAG_ANTERIOR)
#
# Idempotente: se puede repetir sin efectos extra. Pasos:
#   1. Fija IMAGE_TAG en .env   2. Respaldo previo   3. docker compose pull
#   4. Postgres y Redis arriba  5. Migraciones       6. up -d --wait   7. Verifica HTTPS
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
ENV_FILE="$RAIZ/.env"
COMPOSE=(docker compose -f "$RAIZ/docker-compose.yml")

log() { printf '[deploy %s] %s\n' "$(date '+%F %T')" "$*"; }
falla() { log "ERROR: $*"; exit 1; }

# Lee una variable: primero del entorno, luego de .env, si no el valor por defecto.
leer_env() {
  local clave="$1" defecto="${2:-}" valor
  valor="${!clave:-}"
  if [[ -z "$valor" && -f "$ENV_FILE" ]]; then
    valor="$(grep -E "^${clave}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  fi
  printf '%s' "${valor:-$defecto}"
}

# Escribe CLAVE=valor en .env (reemplaza o agrega).
fijar_env() {
  local clave="$1" valor="$2"
  if grep -qE "^${clave}=" "$ENV_FILE"; then
    sed -i "s|^${clave}=.*|${clave}=${valor}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$clave" "$valor" >>"$ENV_FILE"
  fi
}

command -v docker >/dev/null || falla "docker no está instalado"
docker compose version >/dev/null || falla "falta el plugin docker compose v2"
[[ -f "$ENV_FILE" ]] || falla "no existe $ENV_FILE (copie .env.example y complete los valores)"
chmod 600 "$ENV_FILE"

DOMINIO="$(leer_env DOMINIO)"
[[ -n "$DOMINIO" ]] || falla "defina DOMINIO en .env"
MIGRATE_CMD="$(leer_env MIGRATE_CMD 'npm run --if-present db:migrate')"

# 1. Versión
ACTUAL="$(leer_env IMAGE_TAG latest)"
VERSION="${1:-$ACTUAL}"
if [[ "$VERSION" != "$ACTUAL" ]]; then
  fijar_env IMAGE_TAG_ANTERIOR "$ACTUAL"
  fijar_env IMAGE_TAG "$VERSION"
  log "IMAGE_TAG: $ACTUAL -> $VERSION"
else
  fijar_env IMAGE_TAG "$VERSION"
  log "IMAGE_TAG: $VERSION (sin cambio)"
fi
export IMAGE_TAG="$VERSION"

# 2. Respaldo previo (solo si la base ya está corriendo)
if [[ -n "$("${COMPOSE[@]}" ps --status running -q postgres 2>/dev/null)" ]]; then
  log "Respaldo previo al despliegue"
  "$RAIZ/deploy/backup.sh" predeploy
else
  log "Postgres no está corriendo: se omite el respaldo previo (primer despliegue)"
fi

# 3. Imágenes (multi-arquitectura en GHCR; en la VM se descarga la variante arm64)
log "Descargando imágenes $VERSION"
"${COMPOSE[@]}" pull --quiet

# 4. Infraestructura
log "Levantando postgres y redis"
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 120 postgres redis

# 5. Migraciones (solo hacia adelante; el script db:migrate lo define apps/api)
log "Migraciones: $MIGRATE_CMD"
"${COMPOSE[@]}" run --rm --no-deps -T api sh -c "$MIGRATE_CMD"

# 6. Aplicación
log "Levantando todos los servicios"
if ! "${COMPOSE[@]}" up -d --no-build --remove-orphans --wait --wait-timeout 180; then
  "${COMPOSE[@]}" ps
  falla "algún servicio no quedó sano en 180 s. Revise: docker compose logs --tail=100 <servicio>. Revertir: ./deploy/deploy.sh $(leer_env IMAGE_TAG_ANTERIOR latest)"
fi

# 7. Verificación externa (HTTPS real a través de Caddy)
for intento in 1 2 3 4 5 6; do
  if curl -fsS -m 10 "https://${DOMINIO}/api/v1/health" >/dev/null 2>&1; then
    log "OK: https://${DOMINIO} responde (versión $VERSION)"
    docker image prune -f >/dev/null || true
    exit 0
  fi
  log "Esperando HTTPS (intento $intento/6)..."
  sleep 10
done
falla "https://${DOMINIO}/api/v1/health no responde. Revise: docker compose logs caddy api"
