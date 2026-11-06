import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { crearDb, crearPool } from '@menu/db';
import { crearAdaptadores } from './adaptadores.js';
import { ejecutarCorrida } from './corrida.js';
import { LimitadorPorSitio } from './limitador.js';
import { COLA_CORRIDA, COLA_RECALCULO, programarCorrida } from './programador.js';
import { RepositorioRecalculoPg, recalcularCorrida } from './recalculo.js';
import { descargarRobots, fechaLocal } from './red.js';
import { RepositorioCorridasPg } from './repositorio-corridas.js';
import { leerFlagsSitios, esSitio } from './sitios.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const databaseUrl = process.env.DATABASE_URL;
const intervaloMs = Number(process.env.SCRAPER_MIN_INTERVAL_MS ?? 1000);
const flags = leerFlagsSitios();

const log = (nivel: 'info' | 'warn' | 'error', msg: string, extra: object = {}) =>
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), level: nivel, svc: 'worker', msg, ...extra }) +
      '\n',
  );

if (!databaseUrl) {
  log('error', 'Falta DATABASE_URL: el worker de precios no puede arrancar');
  process.exit(1);
}

const conexion = new Redis(redisUrl, { maxRetriesPerRequest: null });
const pool = crearPool(databaseUrl);
const db = crearDb(pool);
const colaCorrida = new Queue(COLA_CORRIDA, { connection: conexion });
const colaRecalculo = new Queue(COLA_RECALCULO, { connection: conexion });

const depsCorrida = {
  repo: new RepositorioCorridasPg(db),
  adaptadores: crearAdaptadores(),
  sitioEncendido: (codigo: string) => esSitio(codigo) && flags[codigo],
  obtenerRobots: (origen: string, agente: string) => descargarRobots(origen, agente),
  limitador: new LimitadorPorSitio(intervaloMs),
  reloj: () => new Date(),
  fechaLocal: (ahora: Date) => fechaLocal(ahora),
  encolarRecalculo: async (corridaId: string) => {
    await colaRecalculo.add('recalculo', { corridaId });
  },
};

const workerCorrida = new Worker(
  COLA_CORRIDA,
  async (job) => {
    const resumen = await ejecutarCorrida(depsCorrida, {
      disparo: job.name === 'manual' ? 'MANUAL' : 'PROGRAMADA',
    });
    return resumen;
  },
  { connection: conexion, concurrency: 1 },
);

const repoRecalculo = new RepositorioRecalculoPg(db);
const workerRecalculo = new Worker(
  COLA_RECALCULO,
  async (job) => {
    const ahora = new Date();
    const { corridaId } = job.data as { corridaId: string };
    return recalcularCorrida(repoRecalculo, corridaId, ahora, fechaLocal(ahora));
  },
  { connection: conexion, concurrency: 1 },
);

for (const w of [workerCorrida, workerRecalculo]) {
  w.on('completed', (job, r) => log('info', 'job completado', { cola: w.name, jobId: job.id, r }));
  w.on('failed', (job, err) =>
    log('error', 'job fallido', { cola: w.name, jobId: job?.id, err: err.message }),
  );
  w.on('error', (err) => log('error', 'error del worker', { cola: w.name, err: err.message }));
}

await programarCorrida(colaCorrida);
log('info', 'worker de precios listo', {
  flags,
  intervaloMs,
  adaptadores: [...depsCorrida.adaptadores.keys()],
});

async function apagar(senal: string) {
  log('warn', `recibida ${senal}, cerrando`);
  await Promise.all([workerCorrida.close(), workerRecalculo.close()]);
  await Promise.all([colaCorrida.close(), colaRecalculo.close()]);
  await conexion.quit();
  await pool.end();
  process.exit(0);
}
process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));
