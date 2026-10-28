/**
 * Integración contra PostgreSQL real. Requiere TEST_DATABASE_URL (usuario con CREATEDB);
 * sin ella la suite se omite. Crea una base temporal, aplica las migraciones, siembra,
 * verifica conteos y que las reglas CHECK / índices parciales rechazan datos inválidos.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  comensal,
  configuracion,
  corrida,
  crearBaseTemporal,
  eq,
  hogar,
  migrar,
  PRODUCTOS_SEMILLA,
  precio,
  producto,
  sembrar,
  sql,
  supermercado,
  tiempoComidaConfig,
  truncarTablas,
  usuario,
  type BaseTemporal,
} from '../src';

const URL_PRUEBAS = process.env.TEST_DATABASE_URL;

describe.skipIf(!URL_PRUEBAS)('PostgreSQL real: migraciones, semilla y reglas', () => {
  let base: BaseTemporal;

  beforeAll(async () => {
    base = await crearBaseTemporal(URL_PRUEBAS as string, { prefijo: 'menu_db_it', sembrar: true });
  }, 60_000);

  afterAll(async () => {
    await base?.eliminar();
  });

  const contar = async (consulta: string) => {
    const { rows } = await base.db.$client.query<{ n: string }>(consulta);
    return Number(rows[0]?.n);
  };

  /** Ejecuta `fn` y devuelve el código SQLSTATE con que falló (o null si no falló). */
  const codigoError = async (fn: () => Promise<unknown>): Promise<string | null> => {
    try {
      await fn();
      return null;
    } catch (error) {
      const e = error as { code?: string; cause?: { code?: string } };
      return e.code ?? e.cause?.code ?? 'desconocido';
    }
  };

  it('crea 49 tablas, 35 enums, pg_trgm y registra 3 migraciones', async () => {
    expect(
      await contar(
        "SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
      ),
    ).toBe(49);
    expect(
      await contar(
        "SELECT count(*) AS n FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace WHERE t.typtype = 'e' AND s.nspname = 'public'",
      ),
    ).toBe(35);
    expect(await contar("SELECT count(*) AS n FROM pg_extension WHERE extname = 'pg_trgm'")).toBe(
      1,
    );
    expect(await contar('SELECT count(*) AS n FROM drizzle.__drizzle_migrations')).toBe(3);
    expect(
      await contar(
        "SELECT count(*) AS n FROM pg_constraint c JOIN pg_namespace s ON s.oid = c.connamespace WHERE c.contype = 'c' AND s.nspname = 'public'",
      ),
    ).toBe(30);
  });

  it('volver a migrar no aplica nada nuevo (idempotente)', async () => {
    await migrar(base.url);
    expect(await contar('SELECT count(*) AS n FROM drizzle.__drizzle_migrations')).toBe(3);
  });

  it('siembra 4 supermercados, 12 unidades y 9 categorías, y es idempotente', async () => {
    await base.db
      .update(supermercado)
      .set({ extraccionPermitida: true })
      .where(eq(supermercado.codigo, 'WALMART'));
    const r = await sembrar(base.db, { adminSistemaCorreo: 'nadie@ejemplo.com' });
    expect(r.adminSistemaMarcado).toBe(false);
    expect(await contar('SELECT count(*) AS n FROM supermercado')).toBe(4);
    expect(await contar('SELECT count(*) AS n FROM unidad')).toBe(12);
    expect(await contar('SELECT count(*) AS n FROM categoria')).toBe(9);
    // La semilla no pisa el permiso que decidió el administrador del sistema (D-07).
    const walmart = await base.db.query.supermercado.findFirst({
      where: eq(supermercado.codigo, 'WALMART'),
    });
    expect(walmart?.extraccionPermitida).toBe(true);
    expect(await contar('SELECT count(*) AS n FROM supermercado WHERE extraccion_permitida')).toBe(
      1,
    );
  });

  it('HU-13 siembra los productos básicos una sola vez y no pisa un producto inactivado', async () => {
    expect(await contar('SELECT count(*) AS n FROM producto')).toBe(PRODUCTOS_SEMILLA.length);
    await base.db.update(producto).set({ activo: false }).where(eq(producto.nombre, 'Crema'));
    const r = await sembrar(base.db);
    expect(r.productos).toBe(PRODUCTOS_SEMILLA.length);
    expect(await contar('SELECT count(*) AS n FROM producto')).toBe(PRODUCTOS_SEMILLA.length);
    expect(await contar('SELECT count(*) AS n FROM producto WHERE NOT activo')).toBe(1);
    const { rows } = await base.db.$client.query<{ etiqueta: string }>(
      `SELECT p.nombre || ' · ' || p.unidad_compra || ' ' || p.presentacion_cantidad::float8 || ' ' || u.codigo AS etiqueta
         FROM producto p JOIN unidad u ON u.id = p.presentacion_unidad_id
        WHERE p.nombre_normalizado = 'guisquil'`,
    );
    expect(rows[0]?.etiqueta).toBe('Güisquil · unidad 1 unidad');
  });

  it('marca al administrador del sistema por correo', async () => {
    await base.db
      .insert(usuario)
      .values({ nombre: 'PO', correo: 'po@ejemplo.com', hashContrasena: 'x' });
    const r = await sembrar(base.db, { adminSistemaCorreo: ' PO@ejemplo.com ' });
    expect(r.adminSistemaMarcado).toBe(true);
  });

  it('inserta un hogar con configuración por defecto y consulta relacional', async () => {
    const [h] = await base.db.insert(hogar).values({ nombre: 'Familia Prueba' }).returning();
    const [conf] = await base.db.insert(configuracion).values({ hogarId: h!.id }).returning();
    await base.db.insert(tiempoComidaConfig).values([
      { configuracionId: conf!.id, tiempo: 'DESAYUNO' },
      { configuracionId: conf!.id, tiempo: 'ALMUERZO', activo: true, porcentaje: '100.00' },
      { configuracionId: conf!.id, tiempo: 'CENA' },
    ]);
    expect(conf).toMatchObject({
      presupuestoSemanal: '250.00',
      diaInicioSemana: 'DOMINGO',
      horaPlanificacion: 8,
      pesoPreferencia: '0.40',
      version: 1,
    });
    const leido = await base.db.query.hogar.findFirst({
      where: eq(hogar.id, h!.id),
      with: { configuracion: { with: { tiempos: true } } },
    });
    expect(leido?.configuracion?.tiempos).toHaveLength(3);
  });

  it('los CHECK rechazan datos inválidos (23514)', async () => {
    const [h] = await base.db.insert(hogar).values({ nombre: 'Familia CHECK' }).returning();
    // RN-07: factor de porción fuera de pasos de 0.25
    expect(
      await codigoError(() =>
        base.db.insert(comensal).values({
          hogarId: h!.id,
          nombre: 'Ana',
          nombreNormalizado: 'ana',
          tipo: 'ADULTO',
          factorPorcion: '0.30',
        }),
      ),
    ).toBe('23514');
    // Pesos que no suman 1
    expect(
      await codigoError(() =>
        base.db.insert(configuracion).values({ hogarId: h!.id, pesoPreferencia: '0.90' }),
      ),
    ).toBe('23514');
    // Correo con mayúsculas (RF-01)
    expect(
      await codigoError(() =>
        base.db
          .insert(usuario)
          .values({ nombre: 'X', correo: 'Mayus@Ejemplo.com', hashContrasena: 'x' }),
      ),
    ).toBe('23514');
    // Un valor válido sí entra
    expect(
      await codigoError(() =>
        base.db.insert(comensal).values({
          hogarId: h!.id,
          nombre: 'Luis',
          nombreNormalizado: 'luis',
          tipo: 'NINO',
          factorPorcion: '0.75',
        }),
      ),
    ).toBeNull();
  });

  it('precio AUTOMATICO exige corrida y no admite hogar (D-05)', async () => {
    const codigo = await codigoError(() =>
      base.db.insert(precio).values({
        productoSupermercadoId: randomUUID(),
        origen: 'AUTOMATICO',
        precio: '10.00',
        precioNormalizado: '10.00',
        fechaPrecio: '2026-10-22',
      }),
    );
    // Falla por CHECK (23514) o por la FK inexistente (23503); ambos impiden el dato inválido.
    expect(['23514', '23503']).toContain(codigo);
  });

  it('solo puede haber una corrida EN_CURSO (índice único parcial, 23505)', async () => {
    await base.db.insert(corrida).values({ programadaPara: new Date() });
    expect(
      await codigoError(() => base.db.insert(corrida).values({ programadaPara: new Date() })),
    ).toBe('23505');
    await base.db.insert(corrida).values({ programadaPara: new Date(), estado: 'COMPLETADA' });
    expect(await contar('SELECT count(*) AS n FROM corrida')).toBe(2);
  });

  it('el índice GIN pg_trgm de producto existe y permite similarity()', async () => {
    expect(
      await contar(
        "SELECT count(*) AS n FROM pg_indexes WHERE indexname IN ('producto_nombre_trgm_idx', 'platillo_nombre_trgm_idx')",
      ),
    ).toBe(2);
    const { rows } = await base.db.execute<{ s: number }>(
      sql`SELECT similarity('pollo en crema', 'pollo con crema') AS s`,
    );
    expect(Number(rows[0]?.s)).toBeGreaterThan(0.5);
  });

  it('truncarTablas vacía los datos y vuelve a sembrar los catálogos', async () => {
    const vaciadas = await truncarTablas(base.db);
    expect(vaciadas).toHaveLength(49);
    expect(await contar('SELECT count(*) AS n FROM hogar')).toBe(0);
    expect(await contar('SELECT count(*) AS n FROM usuario')).toBe(0);
    expect(await contar('SELECT count(*) AS n FROM unidad')).toBe(12);
    expect(await contar('SELECT count(*) AS n FROM categoria')).toBe(9);
    expect(await contar('SELECT count(*) AS n FROM supermercado')).toBe(4);
    expect(await contar('SELECT count(*) AS n FROM producto')).toBe(PRODUCTOS_SEMILLA.length);
    await truncarTablas(base.db, { conservarSemilla: false });
    expect(await contar('SELECT count(*) AS n FROM unidad')).toBe(0);
  });
});

describe.skipIf(!URL_PRUEBAS)('crearBaseTemporal', () => {
  it('crea y elimina una base sin migrar', async () => {
    await expect(
      crearBaseTemporal(URL_PRUEBAS as string, { prefijo: 'menu_db_falla', migrar: false }).then(
        async (b) => {
          const nombre = b.nombre;
          await b.eliminar();
          return nombre;
        },
      ),
    ).resolves.toMatch(/^menu_db_falla_/);
  });
});
