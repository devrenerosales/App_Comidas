import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { is } from 'drizzle-orm';
import { getTableConfig, isPgEnum, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  CARPETA_MIGRACIONES,
  CATEGORIAS_SEMILLA,
  PRODUCTOS_SEMILLA,
  SUPERMERCADOS_SEMILLA,
  UNIDADES_SEMILLA,
  crearDb,
  normalizarNombreSemilla,
  esquema,
  urlConBase,
} from '../src';
import { LARGO_MAXIMO_IDENTIFICADOR, indice } from '../src/schema/comun';
import { cargarEntorno, variableRequerida } from '../src/entorno';

const tablas = (Object.values(esquema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));

describe('esquema Drizzle', () => {
  it('define 49 tablas y 35 enums', () => {
    expect(tablas).toHaveLength(49);
    expect((Object.values(esquema) as unknown[]).filter((v) => isPgEnum(v))).toHaveLength(35);
  });

  it('usa snake_case y nombres de restricciones de hasta 63 caracteres', () => {
    for (const t of tablas) {
      const c = getTableConfig(t);
      expect(c.name).toMatch(/^[a-z][a-z0-9_]*$/);
      for (const col of c.columns) expect(col.name).toMatch(/^[a-z][a-z0-9_]*$/);
      const nombres = [
        ...c.indexes.map((i) => i.config.name ?? ''),
        ...c.foreignKeys.map((f) => f.getName()),
        ...c.primaryKeys.map((p) => p.getName()),
      ];
      for (const n of nombres) expect(n.length).toBeLessThanOrEqual(LARGO_MAXIMO_IDENTIFICADOR);
    }
  });

  it('el dinero es numeric(10,2) y los instantes timestamptz(3)', () => {
    const c = getTableConfig(esquema.precio);
    const tipo = (n: string) => c.columns.find((x) => x.name === n)!.getSQLType();
    expect(tipo('precio')).toBe('numeric(10, 2)');
    expect(tipo('created_at')).toBe('timestamp (3) with time zone');
    expect(tipo('fecha_precio')).toBe('date');
    expect(tipo('id')).toBe('uuid');
  });

  it('rechaza identificadores generados de más de 63 caracteres', () => {
    const largo = getTableConfig(esquema.productoSupermercado).columns.find(
      (c) => c.name === 'presentacion_unidad_id',
    )!;
    const tabla = getTableConfig(esquema.productoSupermercado).columns.find(
      (c) => c.name === 'producto_id',
    )!;
    expect(() => indice(largo, tabla, largo)).toThrow(/demasiado largo/);
  });
});

describe('migraciones y semilla (sin base de datos)', () => {
  it('la carpeta de migraciones tiene extensiones, init y reglas en ese orden', () => {
    const journal = JSON.parse(
      readFileSync(join(CARPETA_MIGRACIONES, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((e) => e.tag)).toEqual([
      '0000_extensiones',
      '0001_init',
      '0002_reglas_integridad',
    ]);
    for (const e of journal.entries) {
      expect(existsSync(join(CARPETA_MIGRACIONES, `${e.tag}.sql`))).toBe(true);
    }
    expect(readFileSync(join(CARPETA_MIGRACIONES, '0000_extensiones.sql'), 'utf8')).toContain(
      'CREATE EXTENSION IF NOT EXISTS pg_trgm',
    );
  });

  it('la semilla trae los 4 supermercados con la extracción apagada (D-07)', () => {
    expect(SUPERMERCADOS_SEMILLA.map((s) => s.codigo).sort()).toEqual([
      'LA_TORRE',
      'PAIZ',
      'SUPER_FRESH',
      'WALMART',
    ]);
    expect(SUPERMERCADOS_SEMILLA.every((s) => s.extraccionPermitida === false)).toBe(true);
    expect(UNIDADES_SEMILLA).toHaveLength(12);
    expect(CATEGORIAS_SEMILLA.map((c) => c.orden)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('HU-13 la semilla trae ~40 productos básicos sin repetir nombre + presentación', () => {
    expect(PRODUCTOS_SEMILLA.length).toBeGreaterThanOrEqual(40);
    const claves = PRODUCTOS_SEMILLA.map(
      (p) => `${normalizarNombreSemilla(p.nombre)}|${Number(p.cantidad)}|${p.unidad}`,
    );
    expect(new Set(claves).size).toBe(claves.length);
    expect(PRODUCTOS_SEMILLA.every((p) => Number(p.cantidad) > 0)).toBe(true);
    expect(PRODUCTOS_SEMILLA.every((p) => p.unidadCompra.length <= 20)).toBe(true);
    const nombres = PRODUCTOS_SEMILLA.map((p) => p.nombre);
    expect(nombres).toEqual(
      expect.arrayContaining(['Pechuga de pollo', 'Frijol negro', 'Güisquil', 'Aceite', 'Crema']),
    );
    // CA-12.2 crea "Miltomate" desde el buscador: no debe venir en la semilla.
    expect(nombres).not.toContain('Miltomate');
  });

  it('normalizarNombreSemilla quita tildes, mayúsculas y espacios de más', () => {
    expect(normalizarNombreSemilla('  Güisquil   TIERNO ')).toBe('guisquil tierno');
  });
});

describe('cliente y utilidades', () => {
  it('crearDb no abre conexiones hasta la primera consulta', async () => {
    const db = crearDb('postgresql://nadie@127.0.0.1:1/ninguna');
    expect(db.$client.totalCount).toBe(0);
    expect(db.query.usuario).toBeDefined();
    await db.$client.end();
  });

  it('urlConBase cambia solo la base de datos', () => {
    expect(urlConBase('postgresql://u:p@h:5433/menu_test?sslmode=disable', 'otra')).toBe(
      'postgresql://u:p@h:5433/otra?sslmode=disable',
    );
  });

  it('variableRequerida falla con un mensaje claro', () => {
    delete process.env.VARIABLE_QUE_NO_EXISTE;
    expect(() => variableRequerida('VARIABLE_QUE_NO_EXISTE')).toThrow(/VARIABLE_QUE_NO_EXISTE/);
    process.env.VARIABLE_DE_PRUEBA = 'x';
    expect(variableRequerida('VARIABLE_DE_PRUEBA')).toBe('x');
  });

  it('cargarEntorno lee .env sin sobrescribir variables existentes', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'menu-db-'));
    writeFileSync(
      join(dir, '.env'),
      '# comentario\nNUEVA_VAR="con comillas"\nexport OTRA=1\nYA_EXISTE=archivo\n',
    );
    process.env.YA_EXISTE = 'entorno';
    cargarEntorno([dir, join(dir, 'no-existe')]);
    expect(process.env.NUEVA_VAR).toBe('con comillas');
    expect(process.env.OTRA).toBe('1');
    expect(process.env.YA_EXISTE).toBe('entorno');
  });
});
