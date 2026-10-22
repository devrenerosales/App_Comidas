/**
 * @menu/db — acceso a PostgreSQL con Drizzle ORM (ADR-010).
 * Esquema (fuente de verdad del modelo), cliente, migraciones, semilla y utilidades de prueba.
 */
export * from './schema';
export * as esquema from './schema';
export type * from './tipos';
export { crearDb, crearPool, OPCIONES_POOL_POR_DEFECTO } from './cliente';
export type { Db, Esquema, OpcionesPool } from './cliente';
export { CANDADO_MIGRACIONES, CARPETA_MIGRACIONES, TABLA_MIGRACIONES, migrar } from './migraciones';
export {
  CATEGORIAS_SEMILLA,
  PRODUCTOS_SEMILLA,
  SUPERMERCADOS_SEMILLA,
  UNIDADES_SEMILLA,
  normalizarNombreSemilla,
  sembrar,
} from './semilla';
export type { OpcionesSemilla, ProductoSemilla, ResultadoSemilla } from './semilla';
export { TABLAS_SEMILLA, crearBaseTemporal, truncarTablas, urlConBase } from './pruebas';
export type { BaseTemporal, OpcionesBaseTemporal } from './pruebas';
// Operadores de Drizzle reexportados para que API y worker usen la misma instancia.
export { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';
export type { Pool, PoolConfig } from 'pg';
