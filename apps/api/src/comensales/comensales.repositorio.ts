import { Inject, Injectable } from '@nestjs/common';
import { and, asc, comensal, desc, eq, hogar, sql, type Comensal, type Db } from '@menu/db';
import { normalizarNombreComensal } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import type { CambiosComensal, DatosComensal } from './comensales.tipos';

/** Ya existe un comensal con ese nombre en el hogar (UK `hogar_id, nombre_normalizado`, E1). */
export class NombreRepetidoError extends Error {
  constructor() {
    super('Nombre de comensal repetido en el hogar');
  }
}

/** Se intentó inactivar al último comensal activo del hogar (CU-01.3 E2). */
export class UltimoComensalError extends Error {
  constructor() {
    super('Debe quedar al menos un comensal activo');
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Acceso a `comensal` (Drizzle). Toda consulta filtra por `hogarId` (RNF-06): un id de otro
 * hogar se comporta como inexistente. Las escrituras bloquean la fila del hogar para que dos
 * cambios simultáneos no dejen el hogar sin comensales activos.
 */
@Injectable()
export class ComensalesRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Activos primero y luego por fecha de alta. */
  listar(hogarId: string, incluirInactivos: boolean): Promise<Comensal[]> {
    const filtro = incluirInactivos
      ? eq(comensal.hogarId, hogarId)
      : and(eq(comensal.hogarId, hogarId), eq(comensal.activo, true));
    return this.db
      .select()
      .from(comensal)
      .where(filtro)
      .orderBy(desc(comensal.activo), asc(comensal.createdAt), asc(comensal.id));
  }

  async buscar(hogarId: string, id: string): Promise<Comensal | undefined> {
    const [fila] = await this.db
      .select()
      .from(comensal)
      .where(and(eq(comensal.hogarId, hogarId), eq(comensal.id, id)))
      .limit(1);
    return fila;
  }

  /** Comensal (activo o no) con ese nombre normalizado en el hogar. */
  async buscarPorNombre(hogarId: string, nombre: string): Promise<Comensal | undefined> {
    const [fila] = await this.db
      .select()
      .from(comensal)
      .where(
        and(
          eq(comensal.hogarId, hogarId),
          eq(comensal.nombreNormalizado, normalizarNombreComensal(nombre)),
        ),
      )
      .limit(1);
    return fila;
  }

  /** Inserta un comensal activo. Lanza `NombreRepetidoError` si el nombre ya existe. */
  crear(hogarId: string, datos: DatosComensal): Promise<Comensal> {
    return this.escribir(hogarId, async (tx) => {
      const [fila] = await tx
        .insert(comensal)
        .values({ hogarId, ...datos, nombreNormalizado: normalizarNombreComensal(datos.nombre) })
        .returning();
      return fila as Comensal;
    });
  }

  /** Aplica los cambios; `undefined` si no existe en el hogar. */
  actualizar(hogarId: string, id: string, cambios: CambiosComensal): Promise<Comensal | undefined> {
    const valores = {
      ...cambios,
      ...(cambios.nombre !== undefined && {
        nombreNormalizado: normalizarNombreComensal(cambios.nombre),
      }),
    };
    return this.escribir(hogarId, async (tx) => {
      if (Object.keys(valores).length === 0) {
        const [actual] = await tx
          .select()
          .from(comensal)
          .where(and(eq(comensal.hogarId, hogarId), eq(comensal.id, id)));
        return actual;
      }
      const [fila] = await tx
        .update(comensal)
        .set(valores)
        .where(and(eq(comensal.hogarId, hogarId), eq(comensal.id, id)))
        .returning();
      return fila;
    });
  }

  /**
   * Inactiva el comensal (quitar = baja lógica). Repetir no es error. Lanza
   * `UltimoComensalError` si es el último activo del hogar.
   */
  inactivar(hogarId: string, id: string): Promise<Comensal | undefined> {
    return this.escribir(hogarId, async (tx) => {
      const [actual] = await tx
        .select()
        .from(comensal)
        .where(and(eq(comensal.hogarId, hogarId), eq(comensal.id, id)));
      if (!actual || !actual.activo) return actual;
      const [conteo] = await tx
        .select({ activos: sql<number>`count(*)::int` })
        .from(comensal)
        .where(and(eq(comensal.hogarId, hogarId), eq(comensal.activo, true)));
      if ((conteo?.activos ?? 0) <= 1) throw new UltimoComensalError();
      const [fila] = await tx
        .update(comensal)
        .set({ activo: false })
        .where(eq(comensal.id, id))
        .returning();
      return fila;
    });
  }

  /** Vuelve a activar un comensal inactivo; `undefined` si no existe en el hogar. */
  reactivar(hogarId: string, id: string): Promise<Comensal | undefined> {
    return this.escribir(hogarId, async (tx) => {
      const [fila] = await tx
        .update(comensal)
        .set({ activo: true })
        .where(and(eq(comensal.hogarId, hogarId), eq(comensal.id, id)))
        .returning();
      return fila;
    });
  }

  /** Transacción con la fila del hogar bloqueada; traduce la violación de unicidad. */
  private async escribir<T>(hogarId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      return await this.db.transaction(async (tx) => {
        await tx.select({ id: hogar.id }).from(hogar).where(eq(hogar.id, hogarId)).for('update');
        return fn(tx);
      });
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new NombreRepetidoError();
      throw error;
    }
  }
}
