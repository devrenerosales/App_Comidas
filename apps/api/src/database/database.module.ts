import { Global, Inject, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { crearDb, crearPool, type Db, type Pool } from '@menu/db';
import { DB, PG_POOL, TIMEOUT_CONSULTA_MS } from './database.constants';

/** Crea el pool de PostgreSQL. Perezoso: no conecta hasta la primera consulta. */
export function crearPoolDesdeConfig(config: ConfigService): Pool {
  const pool = crearPool(config.getOrThrow<string>('DATABASE_URL'), {
    max: 10,
    connectionTimeoutMillis: TIMEOUT_CONSULTA_MS,
    idleTimeoutMillis: 30_000,
    application_name: 'menu-api',
  });
  // Un cliente inactivo que pierde la conexión emite 'error'; sin manejador tumbaría el proceso.
  const logger = new Logger('DatabaseModule');
  pool.on('error', (error) => logger.warn(`Conexión inactiva con error: ${error.message}`));
  return pool;
}

/**
 * Acceso a PostgreSQL con Drizzle (ADR-010). Global: cualquier repositorio inyecta `DB`.
 * La conexión es perezosa: si la base no está disponible al arrancar, la API sigue viva
 * y el health check lo reporta.
 */
@Global()
@Module({
  providers: [
    { provide: PG_POOL, inject: [ConfigService], useFactory: crearPoolDesdeConfig },
    { provide: DB, inject: [PG_POOL], useFactory: (pool: Pool): Db => crearDb(pool) },
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Cierre ordenado: espera a que terminen las consultas en curso y libera las conexiones. */
  async onModuleDestroy(): Promise<void> {
    if (this.pool.ending || this.pool.ended) return;
    try {
      await this.pool.end();
    } catch (error) {
      this.logger.warn(
        `Error al cerrar la conexión a la base de datos: ${(error as Error).message}`,
      );
    }
  }
}
