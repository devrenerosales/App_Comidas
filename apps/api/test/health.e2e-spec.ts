import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { DB, PG_POOL } from '../src/database/database.constants';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { crearAppConBd, describeConBd, redisSimulado, URL_BD_PRUEBAS } from './utils/base-datos';

/** App con BD y Redis simulados (sin red). */
async function crearAppSimulada(estado: { bdArriba: boolean; redisArriba: boolean }) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue({ ending: false, ended: false, end: () => Promise.resolve() })
    .overrideProvider(DB)
    .useValue({
      execute: () =>
        estado.bdArriba ? Promise.resolve({ rows: [] }) : Promise.reject(new Error('BD caída')),
    })
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisSimulado(estado.redisArriba))
    .compile();
  const app = configurarApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

/** App sin ningún mock: DATABASE_URL y REDIS_URL de setup-env apuntan a puertos cerrados. */
async function crearAppReal() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configurarApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}

describe('GET /api/v1/health (e2e)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('responde 200 "ok" cuando BD y Redis están arriba', async () => {
    app = await crearAppSimulada({ bdArriba: true, redisArriba: true });
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'up' }, redis: { status: 'up' } },
    });
  });

  it('responde 200 "degraded" cuando la BD está caída', async () => {
    app = await crearAppSimulada({ bdArriba: false, redisArriba: true });
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('down');
  });

  it('no falla con BD y Redis reales inalcanzables (sin mocks)', async () => {
    app = await crearAppReal();
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('down');
    expect(res.body.checks.redis.status).toBe('down');
  }, 15000);

  it('aplica cabeceras de seguridad (Helmet) y CORS', async () => {
    app = await crearAppSimulada({ bdArriba: true, redisArriba: true });
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('responde 404 fuera del prefijo /api/v1', async () => {
    app = await crearAppSimulada({ bdArriba: true, redisArriba: true });
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});

describeConBd('GET /api/v1/health contra PostgreSQL real (TEST_DATABASE_URL)', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reporta la base "up" ejecutando select 1 en el servidor real', async () => {
    app = await crearAppConBd(URL_BD_PRUEBAS as string);
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'up' }, redis: { status: 'up' } },
    });
    expect(res.body.checks.database.latencyMs).toBeLessThan(2000);
  });

  it('cierra el pool real al cerrar la aplicación', async () => {
    app = await crearAppConBd(URL_BD_PRUEBAS as string);
    await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    const pool = app.get(PG_POOL);
    await app.close();
    app = undefined;
    expect(pool.ended).toBe(true);
  });
});
