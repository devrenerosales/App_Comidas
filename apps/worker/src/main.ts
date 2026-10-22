import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { LimitadorPorSitio } from './limitador.js';
import { COLA_PRECIOS, crearProcesadorPrecios, type ResultadoJobPrecio } from './procesador.js';
import { leerFlagsSitios } from './sitios.js';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const intervaloMs = Number(process.env.SCRAPER_MIN_INTERVAL_MS ?? 1000);
const flags = leerFlagsSitios();

const log = (nivel: 'info' | 'warn' | 'error', msg: string, extra: object = {}) =>
  process.stdout.write(
    JSON.stringify({ time: new Date().toISOString(), level: nivel, svc: 'worker', msg, ...extra }) +
      '\n',
  );

const conexion = new Redis(redisUrl, { maxRetriesPerRequest: null });
const procesar = crearProcesadorPrecios({ flags, limitador: new LimitadorPorSitio(intervaloMs) });

const worker = new Worker<unknown, ResultadoJobPrecio>(COLA_PRECIOS, (job) => procesar(job), {
  connection: conexion,
  concurrency: 3,
});

worker.on('completed', (job, r) => log('info', 'job completado', { jobId: job.id, ...r }));
worker.on('failed', (job, err) =>
  log('error', 'job fallido', { jobId: job?.id, err: err.message }),
);
worker.on('error', (err) => log('error', 'error del worker', { err: err.message }));

log('info', `worker escuchando la cola "${COLA_PRECIOS}"`, { flags, intervaloMs });

async function apagar(senal: string) {
  log('warn', `recibida ${senal}, cerrando`);
  await worker.close();
  await conexion.quit();
  process.exit(0);
}
process.on('SIGINT', () => void apagar('SIGINT'));
process.on('SIGTERM', () => void apagar('SIGTERM'));
