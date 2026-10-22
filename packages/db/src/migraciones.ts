import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * Carpeta `packages/db/drizzle` con las migraciones SQL y su `meta/_journal.json`.
 * Se resuelve igual desde `src/*.ts` y desde `dist/*.js` (misma profundidad).
 */
export const CARPETA_MIGRACIONES = fileURLToPath(new URL('../drizzle', import.meta.url));

/** Tabla y esquema donde Drizzle registra las migraciones aplicadas. */
export const TABLA_MIGRACIONES = { esquema: 'drizzle', tabla: '__drizzle_migrations' } as const;

/** Llave del candado consultivo que serializa migraciones concurrentes (p. ej. dos réplicas). */
export const CANDADO_MIGRACIONES = 20261022;

/**
 * Aplica, en orden y una sola vez, las migraciones pendientes de `CARPETA_MIGRACIONES`.
 * Solo hacia adelante: nunca revierte. Usa un cliente dedicado y un candado consultivo.
 */
export async function migrar(url: string, carpeta: string = CARPETA_MIGRACIONES): Promise<void> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await cliente.query('SELECT pg_advisory_lock($1)', [CANDADO_MIGRACIONES]);
    await migrate(drizzle({ client: cliente }), {
      migrationsFolder: carpeta,
      migrationsSchema: TABLA_MIGRACIONES.esquema,
      migrationsTable: TABLA_MIGRACIONES.tabla,
    });
  } finally {
    await cliente
      .query('SELECT pg_advisory_unlock($1)', [CANDADO_MIGRACIONES])
      .catch(() => undefined);
    await cliente.end();
  }
}
