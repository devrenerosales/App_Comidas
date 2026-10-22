import type { Db } from '@menu/db';
import type Redis from 'ioredis';
import { HealthService } from './health.service';

function crear(opts: {
  bd?: () => Promise<unknown>;
  ping?: () => Promise<string>;
  estadoRedis?: string;
}) {
  const connect = jest.fn().mockResolvedValue(undefined);
  const db = {
    execute: jest.fn(opts.bd ?? (() => Promise.resolve({ rows: [{ '?column?': 1 }] }))),
  };
  const redis = {
    status: opts.estadoRedis ?? 'ready',
    connect,
    ping: jest.fn(opts.ping ?? (() => Promise.resolve('PONG'))),
  };
  const servicio = new HealthService(db as unknown as Db, redis as unknown as Redis);
  return { servicio, db, redis, connect };
}

describe('HealthService', () => {
  it('reporta ok cuando BD y Redis responden', async () => {
    const { servicio, db } = crear({});
    const r = await servicio.reporte();
    expect(r.status).toBe('ok');
    expect(r.checks.database.status).toBe('up');
    expect(r.checks.redis.status).toBe('up');
    expect(typeof r.timestamp).toBe('string');
    expect(db.execute).toHaveBeenCalledTimes(1);
  });

  it('reporta degraded sin lanzar cuando la BD falla', async () => {
    const { servicio } = crear({ bd: () => Promise.reject(new Error('ECONNREFUSED\ndetalle')) });
    const r = await servicio.reporte();
    expect(r.status).toBe('degraded');
    expect(r.checks.database).toMatchObject({ status: 'down', error: 'ECONNREFUSED' });
    expect(r.checks.redis.status).toBe('up');
  });

  it('reporta degraded cuando Redis falla con un valor no Error', async () => {
    const { servicio } = crear({ ping: () => Promise.reject('sin conexión') });
    const r = await servicio.reporte();
    expect(r.status).toBe('degraded');
    expect(r.checks.redis).toMatchObject({ status: 'down', error: 'sin conexión' });
  });

  it('conecta Redis de forma perezosa si aún no estaba conectado', async () => {
    const { servicio, connect } = crear({ estadoRedis: 'wait' });
    await servicio.chequearRedis();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('marca down si la dependencia no responde antes del timeout', async () => {
    jest.useFakeTimers();
    const { servicio } = crear({ bd: () => new Promise(() => undefined) });
    const pendiente = servicio.chequearBd();
    await jest.advanceTimersByTimeAsync(2500);
    await expect(pendiente).resolves.toMatchObject({ status: 'down', error: 'timeout 2000 ms' });
    jest.useRealTimers();
  });
});
