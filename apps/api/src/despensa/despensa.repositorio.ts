import { Inject, Injectable } from '@nestjs/common';
import { and, asc, despensaItem, eq, producto, unidad, type Db } from '@menu/db';
import type { FrecuenciaDespensa } from '@menu/shared';
import { DB } from '../database/database.constants';

/** Producto de despensa con lo del catálogo que la pantalla necesita (una fila del JOIN). */
export interface FilaDespensa {
  id: string;
  productoId: string;
  nombre: string;
  unidadCompra: string;
  presentacionCantidad: string;
  presentacionUnidad: string;
  cantidad: string;
  frecuencia: FrecuenciaDespensa;
  ultimaInclusionSemana: string | null;
  notas: string | null;
}

export interface DatosDespensa {
  cantidad: string;
  frecuencia: FrecuenciaDespensa;
  notas: string | null;
}

/** Acceso a la despensa del hogar (RNF-06: siempre por hogar; la baja es lógica). */
@Injectable()
export class DespensaRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  private consulta() {
    return this.db
      .select({
        id: despensaItem.id,
        productoId: despensaItem.productoId,
        nombre: producto.nombre,
        unidadCompra: producto.unidadCompra,
        presentacionCantidad: producto.presentacionCantidad,
        presentacionUnidad: unidad.codigo,
        cantidad: despensaItem.cantidad,
        frecuencia: despensaItem.frecuencia,
        ultimaInclusionSemana: despensaItem.ultimaInclusionSemana,
        notas: despensaItem.notas,
      })
      .from(despensaItem)
      .innerJoin(producto, eq(producto.id, despensaItem.productoId))
      .innerJoin(unidad, eq(unidad.id, producto.presentacionUnidadId));
  }

  /** Productos de despensa activos, por orden alfabético. */
  async listar(hogarId: string): Promise<FilaDespensa[]> {
    const filas = await this.consulta()
      .where(and(eq(despensaItem.hogarId, hogarId), eq(despensaItem.activo, true)))
      .orderBy(asc(producto.nombreNormalizado), asc(despensaItem.id));
    return filas as FilaDespensa[];
  }

  /** Un producto de despensa activo del hogar (null = otro hogar, dado de baja o inexistente). */
  async buscar(hogarId: string, id: string): Promise<FilaDespensa | undefined> {
    const [fila] = await this.consulta()
      .where(
        and(
          eq(despensaItem.id, id),
          eq(despensaItem.hogarId, hogarId),
          eq(despensaItem.activo, true),
        ),
      )
      .limit(1);
    return fila as FilaDespensa | undefined;
  }

  /** El producto del catálogo existe y está activo (el catálogo es común a los hogares, D-05). */
  async productoActivo(productoId: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: producto.id })
      .from(producto)
      .where(and(eq(producto.id, productoId), eq(producto.activo, true)))
      .limit(1);
    return Boolean(fila);
  }

  /** Registro del producto en este hogar, esté activo o dado de baja. */
  async buscarPorProducto(
    hogarId: string,
    productoId: string,
  ): Promise<{ id: string; activo: boolean } | undefined> {
    const [fila] = await this.db
      .select({ id: despensaItem.id, activo: despensaItem.activo })
      .from(despensaItem)
      .where(and(eq(despensaItem.hogarId, hogarId), eq(despensaItem.productoId, productoId)))
      .limit(1);
    return fila;
  }

  async crear(hogarId: string, productoId: string, datos: DatosDespensa): Promise<string> {
    const [fila] = await this.db
      .insert(despensaItem)
      .values({ hogarId, productoId, ...datos })
      .returning({ id: despensaItem.id });
    return fila!.id;
  }

  /** Vuelve a dar de alta un producto dado de baja: toca de nuevo en la primera lista. */
  async reactivar(id: string, datos: DatosDespensa): Promise<void> {
    await this.db
      .update(despensaItem)
      .set({
        ...datos,
        activo: true,
        ultimaInclusionSemana: null,
        ultimaInclusionListaId: null,
      })
      .where(eq(despensaItem.id, id));
  }

  async actualizar(hogarId: string, id: string, parche: Partial<DatosDespensa>): Promise<boolean> {
    const filas = await this.db
      .update(despensaItem)
      .set(parche)
      .where(
        and(
          eq(despensaItem.id, id),
          eq(despensaItem.hogarId, hogarId),
          eq(despensaItem.activo, true),
        ),
      )
      .returning({ id: despensaItem.id });
    return filas.length > 0;
  }

  /** Baja lógica (RF-29): deja de incluirse en las listas. */
  async inactivar(hogarId: string, id: string): Promise<boolean> {
    const filas = await this.db
      .update(despensaItem)
      .set({ activo: false })
      .where(
        and(
          eq(despensaItem.id, id),
          eq(despensaItem.hogarId, hogarId),
          eq(despensaItem.activo, true),
        ),
      )
      .returning({ id: despensaItem.id });
    return filas.length > 0;
  }
}
