import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Esquema = typeof schema;

/** Cliente Drizzle con el esquema completo (consultas `db.select()` y `db.query.*`). */
export type Db = NodePgDatabase<Esquema> & { $client: pg.Pool };

export type OpcionesPool = Omit<pg.PoolConfig, 'connectionString'>;

/** Valores por defecto del pool: fallar rápido si la base no responde (health check, RNF-03). */
export const OPCIONES_POOL_POR_DEFECTO: OpcionesPool = {
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
};

/** Crea un pool de `pg` para la URL indicada. */
export function crearPool(url: string, opciones: OpcionesPool = {}): pg.Pool {
  return new pg.Pool({ ...OPCIONES_POOL_POR_DEFECTO, ...opciones, connectionString: url });
}

/**
 * Crea el cliente Drizzle a partir de una URL de PostgreSQL o de un pool existente.
 * La conexión es perezosa: no se abre ningún socket hasta la primera consulta.
 * Cierre: `await db.$client.end()`.
 */
export function crearDb(fuente: string | pg.Pool, opciones: OpcionesPool = {}): Db {
  const pool = typeof fuente === 'string' ? crearPool(fuente, opciones) : fuente;
  return drizzle({ client: pool, schema });
}
