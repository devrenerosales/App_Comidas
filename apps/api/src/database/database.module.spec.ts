import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Db, Pool } from '@menu/db';
import { DB, PG_POOL, TIMEOUT_CONSULTA_MS } from './database.constants';
import { DatabaseModule } from './database.module';

async function crearModulo(url = 'postgresql://u:p@127.0.0.1:1/nada') {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ DATABASE_URL: url })],
      }),
      DatabaseModule,
    ],
  })
    .overrideProvider(ConfigService)
    .useValue({ getOrThrow: () => url })
    .compile();
  return moduleRef;
}

describe('DatabaseModule', () => {
  it('expone el pool y el cliente Drizzle sin conectar al iniciar', async () => {
    const moduleRef = await crearModulo();
    const pool = moduleRef.get<Pool>(PG_POOL);
    const db = moduleRef.get<Db>(DB);
    expect(pool.totalCount).toBe(0);
    expect(db.$client).toBe(pool);
    expect(pool.options.connectionTimeoutMillis).toBe(TIMEOUT_CONSULTA_MS);
    expect(pool.listenerCount('error')).toBe(1);
    await moduleRef.close();
    expect(pool.ended).toBe(true);
  });

  it('registra un aviso si una conexión inactiva falla, sin tumbar el proceso', async () => {
    const moduleRef = await crearModulo();
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    moduleRef.get<Pool>(PG_POOL).emit('error', new Error('conexión reiniciada'));
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('conexión reiniciada'));
    aviso.mockRestore();
    await moduleRef.close();
  });

  it('el cierre es idempotente y no lanza si end() falla', async () => {
    const pool = { ending: false, ended: false, end: jest.fn().mockRejectedValue(new Error('x')) };
    const modulo = new DatabaseModule(pool as unknown as Pool);
    const aviso = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(modulo.onModuleDestroy()).resolves.toBeUndefined();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('Error al cerrar'));
    pool.ended = true;
    await modulo.onModuleDestroy();
    expect(pool.end).toHaveBeenCalledTimes(1);
    aviso.mockRestore();
  });

  it('una consulta falla rápido si la base no está disponible', async () => {
    const moduleRef = await crearModulo();
    const pool = moduleRef.get<Pool>(PG_POOL);
    try {
      await expect(pool.query('select 1')).rejects.toThrow();
    } finally {
      await moduleRef.close();
    }
  });
});
