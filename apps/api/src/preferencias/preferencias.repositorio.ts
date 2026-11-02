import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  ingredienteExcluido,
  inArray,
  platillo,
  platilloIngrediente,
  producto,
  type Db,
} from '@menu/db';
import { DB } from '../database/database.constants';
import type { ElementoGusto } from './preferencias.tipos';

export interface FilaIngredienteExcluidoEnPlatillo {
  platilloId: string;
  platilloNombre: string;
  productoNombre: string;
}

/** Acceso a ingredientes excluidos y platillos favoritos del hogar (RNF-06: siempre por hogar). */
@Injectable()
export class PreferenciasRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async excluidos(hogarId: string): Promise<ElementoGusto[]> {
    return this.db
      .select({ id: producto.id, nombre: producto.nombre, activo: producto.activo })
      .from(ingredienteExcluido)
      .innerJoin(producto, eq(producto.id, ingredienteExcluido.productoId))
      .where(eq(ingredienteExcluido.hogarId, hogarId))
      .orderBy(asc(producto.nombre), asc(producto.id));
  }

  async favoritos(hogarId: string): Promise<ElementoGusto[]> {
    return this.db
      .select({ id: platillo.id, nombre: platillo.nombre, activo: platillo.activo })
      .from(platillo)
      .where(and(eq(platillo.hogarId, hogarId), eq(platillo.favorito, true)))
      .orderBy(asc(platillo.nombreNormalizado), asc(platillo.id));
  }

  /** Productos del catálogo común por id (inexistentes no aparecen). */
  async productos(ids: string[]): Promise<ElementoGusto[]> {
    if (ids.length === 0) return [];
    return this.db
      .select({ id: producto.id, nombre: producto.nombre, activo: producto.activo })
      .from(producto)
      .where(inArray(producto.id, ids));
  }

  /** Platillos del hogar por id (de otro hogar o inexistentes no aparecen, RNF-06). */
  async platillos(hogarId: string, ids: string[]): Promise<ElementoGusto[]> {
    if (ids.length === 0) return [];
    return this.db
      .select({ id: platillo.id, nombre: platillo.nombre, activo: platillo.activo })
      .from(platillo)
      .where(and(eq(platillo.hogarId, hogarId), inArray(platillo.id, ids)));
  }

  /** Platillos activos del hogar que llevan alguno de los productos dados, con el ingrediente. */
  async platillosConProductos(
    hogarId: string,
    productoIds: string[],
  ): Promise<FilaIngredienteExcluidoEnPlatillo[]> {
    if (productoIds.length === 0) return [];
    return this.db
      .select({
        platilloId: platillo.id,
        platilloNombre: platillo.nombre,
        productoNombre: producto.nombre,
      })
      .from(platilloIngrediente)
      .innerJoin(platillo, eq(platillo.id, platilloIngrediente.platilloId))
      .innerJoin(producto, eq(producto.id, platilloIngrediente.productoId))
      .where(
        and(
          eq(platillo.hogarId, hogarId),
          eq(platillo.activo, true),
          inArray(platilloIngrediente.productoId, productoIds),
        ),
      )
      .orderBy(asc(platillo.nombreNormalizado), asc(platillo.id), asc(producto.nombre));
  }

  /** Reemplaza exclusiones y favoritos del hogar en una sola transacción. */
  async guardar(hogarId: string, productoIds: string[], platilloIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(ingredienteExcluido).where(eq(ingredienteExcluido.hogarId, hogarId));
      if (productoIds.length > 0) {
        await tx
          .insert(ingredienteExcluido)
          .values(productoIds.map((productoId) => ({ hogarId, productoId })));
      }
      await tx
        .update(platillo)
        .set({ favorito: false })
        .where(and(eq(platillo.hogarId, hogarId), eq(platillo.favorito, true)));
      if (platilloIds.length > 0) {
        await tx
          .update(platillo)
          .set({ favorito: true })
          .where(and(eq(platillo.hogarId, hogarId), inArray(platillo.id, platilloIds)));
      }
    });
  }

  /**
   * Filtro para el motor (CU-05.1): ids de platillos del hogar con algún ingrediente excluido.
   * La exclusión prevalece sobre el favorito.
   */
  async platillosExcluidosParaMotor(hogarId: string): Promise<Set<string>> {
    const filas = await this.db
      .selectDistinct({ id: platilloIngrediente.platilloId })
      .from(platilloIngrediente)
      .innerJoin(platillo, eq(platillo.id, platilloIngrediente.platilloId))
      .innerJoin(
        ingredienteExcluido,
        and(
          eq(ingredienteExcluido.productoId, platilloIngrediente.productoId),
          eq(ingredienteExcluido.hogarId, hogarId),
        ),
      )
      .where(eq(platillo.hogarId, hogarId));
    return new Set(filas.map((f) => f.id));
  }
}
