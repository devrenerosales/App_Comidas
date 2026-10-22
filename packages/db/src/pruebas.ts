/**
 * Utilidades para pruebas de integración contra PostgreSQL real (API, worker y este paquete).
 * Cada suite crea su propia base aislada, le aplica las migraciones y la elimina al final,
 * de modo que las suites pueden correr en paralelo sin pisarse.
 */
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { crearDb, type Db } from './cliente';
import { migrar } from './migraciones';
import { sembrar } from './semilla';

/** Tablas que llena la semilla; `truncarTablas` las vuelve a sembrar por defecto. */
export const TABLAS_SEMILLA = ['supermercado', 'unidad', 'categoria'] as const;

export interface OpcionesBaseTemporal {
  /** Prefijo del nombre de la base (minúsculas, dígitos y `_`). Por defecto `prueba`. */
  prefijo?: string;
  /** Aplica las migraciones (por defecto true). */
  migrar?: boolean;
  /** Ejecuta la semilla después de migrar (por defecto false). */
  sembrar?: boolean;
}

export interface BaseTemporal {
  nombre: string;
  url: string;
  db: Db;
  /** Cierra el pool y elimina la base (`DROP DATABASE … WITH (FORCE)`). */
  eliminar(): Promise<void>;
}

/** Cambia la base de datos de una URL de PostgreSQL. */
export function urlConBase(url: string, base: string): string {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

function identificador(nombre: string): string {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(nombre)) {
    throw new Error(`Nombre de base inválido: ${nombre}`);
  }
  return `"${nombre}"`;
}

async function conAdmin<T>(urlAdmin: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const cliente = new pg.Client({ connectionString: urlAdmin });
  await cliente.connect();
  try {
    return await fn(cliente);
  } finally {
    await cliente.end();
  }
}

/**
 * Crea una base nueva en el mismo servidor que `urlAdmin` (p. ej. TEST_DATABASE_URL);
 * el usuario de esa URL necesita permiso CREATEDB.
 */
export async function crearBaseTemporal(
  urlAdmin: string,
  opciones: OpcionesBaseTemporal = {},
): Promise<BaseTemporal> {
  const prefijo = (opciones.prefijo ?? 'prueba').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const nombre = `${prefijo.slice(0, 40)}_${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  await conAdmin(urlAdmin, (c) => c.query(`CREATE DATABASE ${identificador(nombre)}`));
  const url = urlConBase(urlAdmin, nombre);
  const eliminarBase = () =>
    conAdmin(urlAdmin, (c) =>
      c.query(`DROP DATABASE IF EXISTS ${identificador(nombre)} WITH (FORCE)`),
    ).then(() => undefined);

  try {
    if (opciones.migrar ?? true) await migrar(url);
    const db = crearDb(url, { max: 4 });
    // Al eliminar la base con FORCE, PostgreSQL corta las conexiones inactivas: no es un error.
    db.$client.on('error', () => undefined);
    if (opciones.sembrar) await sembrar(db);
    return {
      nombre,
      url,
      db,
      async eliminar() {
        await db.$client.end().catch(() => undefined);
        await eliminarBase();
      },
    };
  } catch (error) {
    await eliminarBase().catch(() => undefined);
    throw error;
  }
}

/**
 * Vacía todas las tablas del esquema `public` (TRUNCATE … RESTART IDENTITY CASCADE) en una
 * sola sentencia y, por defecto, vuelve a cargar la semilla. Útil en `beforeEach` cuando una
 * suite comparte su base entre pruebas.
 *
 * Se vacía todo y se vuelve a sembrar (en lugar de excluir las tablas semilla) porque
 * `supermercado.permiso_revisado_por_id` referencia a `usuario`: vaciar usuarios arrastra a
 * los supermercados por CASCADE. Los ids de la semilla cambian tras cada llamada.
 */
export async function truncarTablas(
  db: Db,
  opciones: { conservarSemilla?: boolean } = {},
): Promise<string[]> {
  const { rows } = await db.$client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const tablas = rows.map((r) => r.tablename);
  if (tablas.length > 0) {
    await db.$client.query(
      `TRUNCATE TABLE ${tablas.map((t) => `"public"."${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  if (opciones.conservarSemilla ?? true) await sembrar(db);
  return tablas;
}
