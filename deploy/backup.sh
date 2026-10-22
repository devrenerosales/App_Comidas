#!/usr/bin/env bash
# Respaldo de PostgreSQL de Menú Familiar (RNF-11, ADR-009).
#
#   Uso:  ./deploy/backup.sh [etiqueta]      etiqueta: diario (por defecto) | predeploy | manual
#   Cron (diario 02:30, hora de la VM en America/Guatemala):
#     30 2 * * * /srv/menu/deploy/backup.sh diario >> /srv/menu/respaldos/backup.log 2>&1
#
# Genera pg_dump -Fc, lo verifica con pg_restore -l, borra los de más de
# BACKUP_RETENTION_DAYS días (14) y, si está configurado, copia el archivo fuera de
# la VM a Object Storage de OCI (oci CLI + OCI_BUCKET). La laptop del PO puede
# además traerse los respaldos con rsync (ver docs/02-diseno/despliegue.md §8).
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"
ENV_FILE="$RAIZ/.env"
COMPOSE=(docker compose -f "$RAIZ/docker-compose.yml")

log() { printf '[backup %s] %s\n' "$(date '+%F %T')" "$*"; }
falla() { log "ERROR: $*"; exit 1; }

leer_env() {
  local clave="$1" defecto="${2:-}" valor
  valor="${!clave:-}"
  if [[ -z "$valor" && -f "$ENV_FILE" ]]; then
    valor="$(grep -E "^${clave}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  fi
  printf '%s' "${valor:-$defecto}"
}

ETIQUETA="${1:-diario}"
DIR="$(leer_env BACKUP_DIR /srv/menu/respaldos)"
RETENCION="$(leer_env BACKUP_RETENTION_DAYS 14)"
OCI_BUCKET="$(leer_env OCI_BUCKET)"
PING_URL="$(leer_env BACKUP_PING_URL)"

[[ "$RETENCION" =~ ^[0-9]+$ ]] || falla "BACKUP_RETENTION_DAYS debe ser un número"
umask 077
mkdir -p "$DIR"

ARCHIVO="$DIR/menu-$(date +%Y%m%d-%H%M%S)-${ETIQUETA}.dump"
TMP="${ARCHIVO}.parcial"
trap 'rm -f "$TMP"' EXIT

log "pg_dump -> $ARCHIVO"
# shellcheck disable=SC2016  # las variables se expanden dentro del contenedor
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' >"$TMP"
[[ -s "$TMP" ]] || falla "el respaldo quedó vacío"

# Verifica que el archivo sea un dump legible.
"${COMPOSE[@]}" exec -T postgres pg_restore -l <"$TMP" >/dev/null || falla "pg_restore -l no pudo leer el respaldo"
mv "$TMP" "$ARCHIVO"
log "OK $(du -h "$ARCHIVO" | cut -f1)"

# Rotación local: conserva BACKUP_RETENTION_DAYS días.
borrados="$(find "$DIR" -maxdepth 1 -type f -name 'menu-*.dump' -mmin +$((RETENCION * 1440)) -print -delete | wc -l)"
log "Rotación: $borrados archivo(s) con más de $RETENCION días eliminados"

# Copia fuera de la VM (Object Storage de OCI Always Free). La retención en el bucket
# se maneja con una regla de ciclo de vida (borrar objetos con más de 14 días).
if [[ -n "$OCI_BUCKET" ]]; then
  if command -v oci >/dev/null; then
    oci os object put --bucket-name "$OCI_BUCKET" --file "$ARCHIVO" \
      --name "postgres/$(basename "$ARCHIVO")" --force >/dev/null
    log "Copiado a Object Storage: $OCI_BUCKET/postgres/$(basename "$ARCHIVO")"
  else
    log "AVISO: OCI_BUCKET definido pero falta el CLI 'oci'; no se copió fuera de la VM"
  fi
fi

# Aviso de "respaldo corrió" (opcional, p. ej. Healthchecks.io gratis).
if [[ -n "$PING_URL" ]]; then
  curl -fsS -m 10 --retry 3 "$PING_URL" >/dev/null || log "AVISO: no se pudo notificar $PING_URL"
fi
