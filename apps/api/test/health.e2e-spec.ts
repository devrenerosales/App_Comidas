import * as fs from 'node:fs';
import * as path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';

/**
 * El cliente Prisma y su motor solo existen tras `prisma generate` con acceso a binaries.prisma.sh
 * (en CI sí). Se revisa sin instanciar el cliente para no dejar errores asíncronos sueltos.
 */
function clientePrismaGenerado(): boolean {
  try {
    const dirCliente = path.join(
      path.dirname(require.resolve('@prisma/client')),
      '..',
      '..',
      '.prisma',
      'client',
    );
    return fs
      .readdirSync(dirCliente)
      .some(
        (f) =>
          /^libquery_engine.*\.node$/.test(f) && fs.statSync(path.join(dirCliente, f)).size > 0,
      );
  } catch {
    return false;
  }
}

async function crearApp(overrides?: { bdArriba: boolean; redisArriba: boolean }) {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrides) {
    builder = builder
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: () =>
          overrides.bdArriba ? Promise.resolve([1]) : Promise.reject(new Error('BD caída')),
        onModuleInit: () => undefined,
        onModuleDestroy: () => undefined,
      })
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        status: 'ready',
        connect: () => Promise.resolve(),
        disconnect: () => undefined,
        ping: () =>
          overrides.redisArriba
            ? Promise.resolve('PONG')
            : Promise.reject(new Error('Redis caído')),
      });
  }
  const moduleRef = await builder.compile();
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
    app = await crearApp({ bdArriba: true, redisArriba: true });
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      checks: { database: { status: 'up' }, redis: { status: 'up' } },
    });
  });

  it('responde 200 "degraded" cuando la BD está caída', async () => {
    app = await crearApp({ bdArriba: false, redisArriba: true });
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('down');
  });

  const itConPrisma = clientePrismaGenerado() ? it : it.skip;

  itConPrisma(
    'no falla con BD y Redis reales inalcanzables (sin mocks)',
    async () => {
      app = await crearApp();
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.checks.database.status).toBe('down');
      expect(res.body.checks.redis.status).toBe('down');
    },
    15000,
  );

  it('aplica cabeceras de seguridad (Helmet) y CORS', async () => {
    app = await crearApp({ bdArriba: true, redisArriba: true });
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('responde 404 fuera del prefijo /api/v1', async () => {
    app = await crearApp({ bdArriba: true, redisArriba: true });
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
