/** Token del cliente Drizzle (`Db` de @menu/db). Uso: `@Inject(DB) private readonly db: Db`. */
export const DB = Symbol('DB');

/** Token del pool de `pg` subyacente (cierre ordenado y diagnósticos). */
export const PG_POOL = Symbol('PG_POOL');

/** Límite de una consulta de verificación (`select 1`) del health check. */
export const TIMEOUT_CONSULTA_MS = 2000;
