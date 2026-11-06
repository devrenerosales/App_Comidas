/**
 * Punto de entrada serverless (Vercel) — integración contra PostgreSQL real (TEST_DATABASE_URL).
 * Usa el manejador como lo haría la función: sin Redis, con un solo salto de proxy y pool de 1.
 */
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import request from 'supertest';
import { describeConBd, usarBaseDePruebas } from './utils/base-datos';

const API = '/api/v1';

describeConBd('Despliegue serverless (integración)', () => {
  const bd = usarBaseDePruebas({ suite: 'serverless', sembrar: true });
  let servidor: Server;
  /** Simula los ayudantes de Vercel: `req.query` llega calculado, con el `path` de la reescritura. */
  let servidorVercel: Server;
  let manejador: typeof import('../src/serverless');
  const entornoAnterior = { ...process.env };

  beforeAll(async () => {
    // Como en Vercel: sin REDIS_URL, pool pequeño y un salto de proxy.
    // Vacío (no borrado): el .env local de la raíz no puede reponerlo.
    process.env.REDIS_URL = '';
    process.env.DATABASE_URL = bd.base.url;
    process.env.DB_POOL_MAX = '1';
    process.env.TRUST_PROXY = '1';
    jest.resetModules();
    manejador = await import('../src/serverless');
    servidor = createServer((req, res) => void manejador.default(req, res));
    servidorVercel = createServer((req, res) => {
      const consulta = Object.fromEntries(
        new URL(req.url ?? '/', 'http://localhost').searchParams.entries(),
      );
      Object.defineProperty(req, 'query', {
        value: { path: 'productos', ...consulta },
        configurable: true,
        enumerable: true,
        writable: true,
      });
      void manejador.default(req, res);
    });
  });

  afterAll(async () => {
    servidor?.close();
    servidorVercel?.close();
    await manejador?.cerrarServidor();
    process.env = entornoAnterior;
  });

  it('sin Redis configurado, /health responde ok con redis "disabled"', async () => {
    const res = await request(servidor).get(`${API}/health`).expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.checks.redis.status).toBe('disabled');
  });

  it('crea la aplicación una sola vez y la reutiliza', async () => {
    const primera = await manejador.obtenerServidor();
    const segunda = await manejador.obtenerServidor();
    expect(segunda).toBe(primera);
  });

  it('flujo real: registro y creación de hogar por el manejador (argon2, JWT, BD)', async () => {
    const registro = await request(servidor)
      .post(`${API}/auth/registro`)
      .send({ nombre: 'Rene', correo: 'rene@correo.com', contrasena: 'Almuerzo2026' })
      .expect(201);
    const hogar = await request(servidor)
      .post(`${API}/hogares`)
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ nombre: 'Familia Rene' })
      .expect(201);
    expect(hogar.body.hogar.nombre).toBe('Familia Rene');
  });

  it('una lista con el ?path= que agrega la reescritura de Vercel no se rechaza', async () => {
    const registro = await request(servidor)
      .post(`${API}/auth/registro`)
      .send({ nombre: 'Ana', correo: 'ana@correo.com', contrasena: 'Almuerzo2026' })
      .expect(201);
    const hogar = await request(servidor)
      .post(`${API}/hogares`)
      .set('Authorization', `Bearer ${registro.body.accessToken}`)
      .send({ nombre: 'Familia Ana' })
      .expect(201);
    const token = hogar.body.accessToken as string;

    const sin = await request(servidor)
      .get(`${API}/productos?q=arroz`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const con = await request(servidor)
      .get(`${API}/productos?path=productos&q=arroz`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(con.body).toEqual(sin.body);

    // Con `req.query` ya calculado por Vercel (incluye `path`) tampoco se rechaza.
    const vercel = await request(servidorVercel)
      .get(`${API}/productos?q=arroz`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(vercel.body).toEqual(sin.body);
  });
});
