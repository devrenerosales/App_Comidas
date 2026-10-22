/**
 * Fidelidad del esquema Drizzle respecto del diseño original (docs/02-diseno/historico/schema.prisma).
 * Compara tablas, columnas, tipos, nulabilidad, valores por defecto, llaves primarias, únicos,
 * índices, llaves foráneas (ON DELETE) y enums. No necesita base de datos.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { is } from 'drizzle-orm';
import { getTableConfig, isPgEnum, PgTable, type PgEnum } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as esquema from '../src/schema';

const RUTA_PRISMA = fileURLToPath(
  new URL('../../../docs/02-diseno/historico/schema.prisma', import.meta.url),
);

interface CampoPrisma {
  nombre: string;
  columna: string;
  tipo: string;
  opcional: boolean;
  lista: boolean;
  atributos: string;
}
interface ModeloPrisma {
  nombre: string;
  tabla: string;
  campos: CampoPrisma[];
  bloque: string[];
}

function leerPrisma() {
  const texto = readFileSync(RUTA_PRISMA, 'utf8');
  const enums = new Map<string, { nombre: string; valores: string[] }>();
  const modelos = new Map<string, ModeloPrisma>();
  for (const m of texto.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
    const cuerpo = (m[2] as string).split('\n').map((l) => l.trim());
    const mapa = /@@map\("(\w+)"\)/.exec(m[2] as string);
    enums.set(m[1] as string, {
      nombre: mapa?.[1] ?? (m[1] as string),
      valores: cuerpo.filter((l) => /^[A-Z_]+$/.test(l)),
    });
  }
  for (const m of texto.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const lineas = (m[2] as string)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'));
    const tabla = /@@map\("(\w+)"\)/.exec(m[2] as string)?.[1] ?? (m[1] as string);
    const campos: CampoPrisma[] = [];
    for (const l of lineas) {
      const c = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/.exec(l);
      if (!c || l.startsWith('@@')) continue;
      campos.push({
        nombre: c[1] as string,
        tipo: c[2] as string,
        opcional: c[3] === '?',
        lista: c[3] === '[]',
        atributos: c[4] ?? '',
        columna: /@map\("(\w+)"\)/.exec(c[4] ?? '')?.[1] ?? (c[1] as string),
      });
    }
    modelos.set(m[1] as string, { nombre: m[1] as string, tabla, campos, bloque: lineas });
  }
  return { enums, modelos };
}

const { enums: enumsPrisma, modelos } = leerPrisma();
const ESCALARES = new Set(['String', 'Int', 'Boolean', 'DateTime', 'Decimal', 'Json']);

function esEscalar(c: CampoPrisma) {
  return ESCALARES.has(c.tipo) || enumsPrisma.has(c.tipo);
}

/** Tipo SQL esperado en el formato de `PgColumn.getSQLType()`. */
function tipoEsperado(c: CampoPrisma): string {
  const db = /@db\.(\w+)(?:\(([^)]*)\))?/.exec(c.atributos);
  let base: string;
  if (enumsPrisma.has(c.tipo)) base = enumsPrisma.get(c.tipo)!.nombre;
  else if (c.tipo === 'String')
    base =
      db?.[1] === 'VarChar'
        ? `varchar(${db[2]})`
        : db?.[1] === 'Char'
          ? `char(${db[2]})`
          : db?.[1] === 'Uuid'
            ? 'uuid'
            : 'text';
  else if (c.tipo === 'Int') base = db?.[1] === 'SmallInt' ? 'smallint' : 'integer';
  else if (c.tipo === 'Boolean') base = 'boolean';
  else if (c.tipo === 'Json') base = 'jsonb';
  else if (c.tipo === 'Decimal')
    base = `numeric(${db?.[2]?.replace(/\s/g, '').replace(',', ', ')})`;
  else if (c.tipo === 'DateTime')
    base = db?.[1] === 'Date' ? 'date' : `timestamp (${db?.[2] ?? 3}) with time zone`;
  else throw new Error(`Tipo no soportado: ${c.tipo}`);
  return c.lista ? `${base}[]` : base;
}

/** Nombres de campo dentro de `[a, b(sort: Desc), c(ops: raw("x"))]`. */
function camposDeLista(lista: string): string[] {
  let s = lista;
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, '');
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const tablas = (Object.values(esquema) as unknown[]).filter((v): v is PgTable => is(v, PgTable));
const configPorTabla = new Map(tablas.map((t) => [getTableConfig(t).name, getTableConfig(t)]));

describe('fidelidad con el diseño original (schema.prisma histórico)', () => {
  it('el diseño tiene 49 modelos y 35 enums', () => {
    expect(modelos.size).toBe(49);
    expect(enumsPrisma.size).toBe(35);
  });

  it('cada enum existe con el mismo nombre SQL y los mismos valores en orden', () => {
    const enumsDrizzle = new Map(
      (Object.values(esquema) as unknown[])
        .filter((v): v is PgEnum<[string, ...string[]]> => isPgEnum(v))
        .map((e) => [e.enumName, [...e.enumValues]]),
    );
    expect(enumsDrizzle.size).toBe(35);
    for (const e of enumsPrisma.values()) {
      expect(enumsDrizzle.get(e.nombre), e.nombre).toEqual(e.valores);
    }
  });

  it('las tablas coinciden exactamente', () => {
    expect([...configPorTabla.keys()].sort()).toEqual(
      [...modelos.values()].map((m) => m.tabla).sort(),
    );
  });

  for (const modelo of modelos.values()) {
    describe(`${modelo.nombre} (${modelo.tabla})`, () => {
      const config = configPorTabla.get(modelo.tabla)!;
      const columnas = new Map(config.columns.map((c) => [c.name, c]));
      const columnaDe = (campo: string) =>
        modelo.campos.find((c) => c.nombre === campo)?.columna ?? campo;

      it('columnas, tipos, nulabilidad, defaults y llave primaria', () => {
        const escalares = modelo.campos.filter(esEscalar);
        expect([...columnas.keys()].sort()).toEqual(escalares.map((c) => c.columna).sort());
        for (const campo of escalares) {
          const col = columnas.get(campo.columna)!;
          expect(col.getSQLType(), `${modelo.tabla}.${campo.columna}`).toBe(tipoEsperado(campo));
          expect(col.notNull, `${modelo.tabla}.${campo.columna} NOT NULL`).toBe(!campo.opcional);
          expect(col.primary, `${modelo.tabla}.${campo.columna} PK`).toBe(
            /@id\b/.test(campo.atributos),
          );
          if (/@default\(/.test(campo.atributos) && !/@default\(uuid\(\)\)/.test(campo.atributos)) {
            expect(col.hasDefault, `${modelo.tabla}.${campo.columna} DEFAULT`).toBe(true);
          }
        }
        const pkCompuesta = modelo.bloque.find((l) => l.startsWith('@@id('));
        if (pkCompuesta) {
          const esperadas = camposDeLista(/\[(.*)\]/.exec(pkCompuesta)![1] as string).map(
            columnaDe,
          );
          expect(config.primaryKeys.map((pk) => pk.columns.map((c) => c.name))).toEqual([
            esperadas,
          ]);
        }
      });

      it('índices únicos e índices', () => {
        const unicosEsperados = [
          ...modelo.campos.filter((c) => /@unique\b/.test(c.atributos)).map((c) => [c.columna]),
          ...modelo.bloque
            .filter((l) => l.startsWith('@@unique('))
            .map((l) => camposDeLista(/\[(.*?)\]/.exec(l)![1] as string).map(columnaDe)),
        ];
        const indicesEsperados = modelo.bloque
          .filter((l) => l.startsWith('@@index('))
          .map((l) => camposDeLista(/\[(.*)\]/.exec(l)![1] as string).map(columnaDe));
        const nombresCols = (i: (typeof config.indexes)[number]) =>
          i.config.columns.map((c) => ('name' in c ? c.name : String(c)));
        expect(
          config.indexes
            .filter((i) => i.config.unique)
            .map(nombresCols)
            .map(String)
            .sort(),
        ).toEqual(unicosEsperados.map(String).sort());
        expect(
          config.indexes
            .filter((i) => !i.config.unique)
            .map(nombresCols)
            .map(String)
            .sort(),
        ).toEqual(indicesEsperados.map(String).sort());
      });

      it('llaves foráneas con su acción ON DELETE', () => {
        const accion: Record<string, string> = {
          Cascade: 'cascade',
          Restrict: 'restrict',
          SetNull: 'set null',
        };
        const esperadas = modelo.campos
          .filter((c) => /@relation\([^)]*fields:/.test(c.atributos))
          .map((c) => {
            const campo = /fields: \[(\w+)\]/.exec(c.atributos)![1] as string;
            const borrado = /onDelete: (\w+)/.exec(c.atributos)?.[1] ?? 'Restrict';
            return `${columnaDe(campo)}->${modelos.get(c.tipo)!.tabla}:${accion[borrado]}`;
          })
          .sort();
        const reales = config.foreignKeys
          .map((fk) => {
            const r = fk.reference();
            return `${r.columns[0]!.name}->${getTableConfig(r.foreignTable).name}:${fk.onDelete}`;
          })
          .sort();
        expect(reales).toEqual(esperadas);
      });
    });
  }
});
