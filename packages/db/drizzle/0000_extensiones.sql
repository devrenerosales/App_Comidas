-- Migración manual (ADR-010): extensiones requeridas antes de crear el esquema.
-- pg_trgm habilita los índices GIN gin_trgm_ops de producto y platillo (DM-08, RF-17)
-- que crea 0001_init. Requiere permiso para CREATE EXTENSION (superusuario o dueño de la base).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
