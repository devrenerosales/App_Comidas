/**
 * Utilidades reutilizables para pruebas de integración de la API contra PostgreSQL real.
 *
 * - Sin TEST_DATABASE_URL las suites que usan `describeConBd` se omiten (no fallan).
 * - Cada suite obtiene su propia base aislada (`menu_api_<suite>_<aleatorio>`) con las
 *   migraciones de @menu/db aplicadas; se elimina al terminar la suite.
 * - Entre pruebas: `truncarTablas` (vacía todo y vuelve a sembrar) o `enTransaccionRevertida`
 *   (ejecuta y deshace) según convenga.
 *
 * Ejemplo:
 *   describeConBd('Platillos (integración)', () => {
 *     const bd = usarBaseDePruebas({ suite: 'platillos', sembrar: true, truncarEntrePruebas: true });
 *     let app: INestApplication;
 *     beforeAll(async () => { app = await crearAppConBd(bd.base); });
 *     afterAll(() => app.close());
 *     it('...', async () => { await bd.db.insert(hogar).values({ nombre: 'X' }); });
 *   });
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { crearBaseTemporal, crearPool, truncarTablas, type BaseTemporal, type Db } from '@menu/db';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/app.setup';
import { PG_POOL } from '../../src/database/database.constants';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';

/** URL del servidor de pruebas (usuario con permiso CREATEDB). */
export const URL_BD_PRUEBAS = process.env.TEST_DATABASE_URL;

/** `describe` que se omite limpiamente si no hay PostgreSQL de pruebas. */
export const describeConBd: jest.Describe = URL_BD_PRUEBAS ? describe : describe.skip;

export interface OpcionesBaseDePruebas {
  /** Nombre corto de la suite; forma parte del nombre de la base. */
  suite: string;
  /** Carga supermercados, unidades y categorías (por defecto true). */
  sembrar?: boolean;
  /** Vacía las tablas y vuelve a sembrar antes de cada prueba (por defecto false). */
  truncarEntrePruebas?: boolean;
}

export interface ContextoBaseDePruebas {
  readonly base: BaseTemporal;
  readonly db: Db;
  readonly url: string;
}

/** Crea una base aislada y migrada. Recuerde llamar `eliminar()` al final. */
export function prepararBaseDePruebas(opciones: OpcionesBaseDePruebas): Promise<BaseTemporal> {
  if (!URL_BD_PRUEBAS) {
    throw new Error('Defina TEST_DATABASE_URL para las pruebas de integración.');
  }
  return crearBaseTemporal(URL_BD_PRUEBAS, {
    prefijo: `menu_api_${opciones.suite}`,
    sembrar: opciones.sembrar ?? true,
  });
}

/**
 * Registra `beforeAll`/`afterAll` (y opcionalmente `beforeEach`) para la suite actual y devuelve
 * un contexto perezoso: sus propiedades solo se leen dentro de las pruebas.
 */
export function usarBaseDePruebas(opciones: OpcionesBaseDePruebas): ContextoBaseDePruebas {
  let base: BaseTemporal | undefined;
  beforeAll(async () => {
    base = await prepararBaseDePruebas(opciones);
  }, 60_000);
  afterAll(async () => {
    await base?.eliminar();
  });
  if (opciones.truncarEntrePruebas) {
    beforeEach(async () => {
      await truncarTablas(contexto.db);
    });
  }
  const obtener = (): BaseTemporal => {
    if (!base)
      throw new Error(
        'La base de pruebas aún no está lista (use el contexto dentro de it/beforeEach).',
      );
    return base;
  };
  const contexto: ContextoBaseDePruebas = {
    get base() {
      return obtener();
    },
    get db() {
      return obtener().db;
    },
    get url() {
      return obtener().url;
    },
  };
  return contexto;
}

class RollbackIntencional extends Error {}

/**
 * Ejecuta `fn` dentro de una transacción y la revierte siempre; devuelve el resultado de `fn`.
 * Útil para probar repositorios sin dejar datos.
 */
export async function enTransaccionRevertida<T>(
  db: Db,
  fn: (tx: Parameters<Parameters<Db['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  let resultado: T | undefined;
  try {
    await db.transaction(async (tx) => {
      resultado = await fn(tx);
      throw new RollbackIntencional();
    });
  } catch (error) {
    if (!(error instanceof RollbackIntencional)) throw error;
  }
  return resultado as T;
}

/** Redis simulado (las pruebas de integración de BD no necesitan Redis real). */
export function redisSimulado(arriba = true) {
  return {
    status: 'ready',
    connect: () => Promise.resolve(),
    disconnect: () => undefined,
    ping: () => (arriba ? Promise.resolve('PONG') : Promise.reject(new Error('Redis caído'))),
  };
}

/**
 * Levanta la aplicación Nest completa apuntando a la base indicada (URL o BaseTemporal),
 * con Redis simulado. `personalizar` permite sobrescribir otros proveedores.
 */
export async function crearAppConBd(
  base: BaseTemporal | string,
  personalizar: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<INestApplication> {
  const url = typeof base === 'string' ? base : base.url;
  const pool = crearPool(url, { max: 4 });
  // Si la base aislada se elimina antes que la app (DROP … WITH (FORCE)), el servidor corta
  // las conexiones inactivas; se ignora para no romper la suite.
  pool.on('error', () => undefined);
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(pool)
    .overrideProvider(REDIS_CLIENT)
    .useValue(redisSimulado());
  const moduleRef = await personalizar(builder).compile();
  const app = configurarApp(moduleRef.createNestApplication());
  await app.init();
  return app;
}
