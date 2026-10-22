/**
 * Columnas y convenciones comunes del esquema (modelo-datos.md §1):
 * ids uuid, dinero numeric(10,2) en GTQ, fechas de calendario `date` (texto AAAA-MM-DD),
 * instantes `timestamptz(3)` (UTC) y nombres de índices/llaves al estilo del diseño original
 * (`<tabla>_<columnas>_idx|_key|_fkey`) para no romper referencias en la documentación.
 */
import { getTableName } from 'drizzle-orm';
import {
  date,
  foreignKey,
  index,
  numeric,
  timestamp,
  uniqueIndex,
  uuid,
  type PgColumn,
} from 'drizzle-orm/pg-core';

/** Límite de PostgreSQL para identificadores. */
export const LARGO_MAXIMO_IDENTIFICADOR = 63;

/** Llave primaria uuid v4 generada por la base (`gen_random_uuid()`). */
export const id = () => uuid('id').primaryKey().defaultRandom();

/** Instante con zona horaria y milisegundos (`timestamptz(3)`). */
export const instante = (nombre: string) =>
  timestamp(nombre, { precision: 3, withTimezone: true, mode: 'date' });

/** `created_at` con valor por defecto `now()`. */
export const creadoEn = () => instante('created_at').notNull().defaultNow();

/** `updated_at`: `now()` al insertar y fecha actual en cada `update` de Drizzle. */
export const actualizadoEn = () =>
  instante('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** Decimal exacto; Drizzle lo expone como `string` para no perder precisión. */
export const decimal = (nombre: string, precision: number, scale: number) =>
  numeric(nombre, { precision, scale });

/** Dinero en GTQ: `numeric(10,2)`. */
export const dinero = (nombre: string) => decimal(nombre, 10, 2);

/** Fecha de calendario (`date`), expuesta como texto `AAAA-MM-DD`. */
export const fecha = (nombre: string) => date(nombre, { mode: 'string' });

function nombreTabla(columna: PgColumn): string {
  return getTableName(columna.table);
}

function nombreConSufijo(columnas: PgColumn[], sufijo: string, nombre?: string): string {
  const generado =
    nombre ??
    `${nombreTabla(columnas[0] as PgColumn)}_${columnas.map((c) => c.name).join('_')}_${sufijo}`;
  if (generado.length > LARGO_MAXIMO_IDENTIFICADOR) {
    throw new Error(`Identificador demasiado largo (${generado.length}): ${generado}`);
  }
  return generado;
}

/** Índice B-tree `<tabla>_<columnas>_idx`. */
export function indice(...columnas: [PgColumn, ...PgColumn[]]) {
  return index(nombreConSufijo(columnas, 'idx')).on(...columnas);
}

/** Índice único `<tabla>_<columnas>_key` (o el nombre indicado si excede 63 caracteres). */
export function unico(columnas: [PgColumn, ...PgColumn[]], nombre?: string) {
  return uniqueIndex(nombreConSufijo(columnas, 'key', nombre)).on(...columnas);
}

export type AccionBorrado = 'cascade' | 'restrict' | 'set null';

/** Llave foránea `<tabla>_<columna>_fkey` con ON UPDATE CASCADE. */
export function fk(columna: PgColumn, referencia: PgColumn, alBorrar: AccionBorrado) {
  return foreignKey({
    name: nombreConSufijo([columna], 'fkey'),
    columns: [columna],
    foreignColumns: [referencia],
  })
    .onDelete(alBorrar)
    .onUpdate('cascade');
}
