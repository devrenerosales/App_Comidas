import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  hogarSupermercado,
  inArray,
  isNull,
  marcaPreferida,
  or,
  precio,
  producto,
  productoSupermercado,
  supermercado,
  unidad,
  type Db,
} from '@menu/db';
import { DB } from '../database/database.constants';

export interface FilaSupermercado {
  id: string;
  nombre: string;
  /** null = el hogar todavía no decidió (se toma como preferido). */
  preferido: boolean | null;
}

export interface FilaVinculo {
  id: string;
  marca: string | null;
  marcaNormalizada: string | null;
  supermercado: string;
  presentacionCantidad: string;
  unidad: string;
}

export interface FilaPrecio {
  productoSupermercadoId: string;
  precio: string;
  fechaPrecio: string;
}

/** Acceso a supermercados y marcas preferidas del hogar (RNF-06: siempre por hogar). */
@Injectable()
export class SupermercadosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Supermercados activos con la preferencia del hogar. */
  async supermercados(hogarId: string): Promise<FilaSupermercado[]> {
    return this.db
      .select({
        id: supermercado.id,
        nombre: supermercado.nombre,
        preferido: hogarSupermercado.preferido,
      })
      .from(supermercado)
      .leftJoin(
        hogarSupermercado,
        and(
          eq(hogarSupermercado.supermercadoId, supermercado.id),
          eq(hogarSupermercado.hogarId, hogarId),
        ),
      )
      .where(eq(supermercado.activo, true))
      .orderBy(asc(supermercado.nombre), asc(supermercado.id));
  }

  /** Reemplaza las preferencias de todos los supermercados activos en una transacción. */
  async guardarSupermercados(
    hogarId: string,
    supermercados: { id: string; preferido: boolean }[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(hogarSupermercado).where(eq(hogarSupermercado.hogarId, hogarId));
      if (supermercados.length === 0) return;
      await tx
        .insert(hogarSupermercado)
        .values(
          supermercados.map((s) => ({ hogarId, supermercadoId: s.id, preferido: s.preferido })),
        );
    });
  }

  async marcasElegidas(
    hogarId: string,
  ): Promise<{ productoId: string; producto: string; marca: string }[]> {
    return this.db
      .select({ productoId: producto.id, producto: producto.nombre, marca: marcaPreferida.marca })
      .from(marcaPreferida)
      .innerJoin(producto, eq(producto.id, marcaPreferida.productoId))
      .where(eq(marcaPreferida.hogarId, hogarId))
      .orderBy(asc(producto.nombre), asc(producto.id));
  }

  async producto(id: string): Promise<{ id: string; nombre: string } | null> {
    const [fila] = await this.db
      .select({ id: producto.id, nombre: producto.nombre })
      .from(producto)
      .where(eq(producto.id, id))
      .limit(1);
    return fila ?? null;
  }

  async marcaDe(hogarId: string, productoId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ marca: marcaPreferida.marca })
      .from(marcaPreferida)
      .where(and(eq(marcaPreferida.hogarId, hogarId), eq(marcaPreferida.productoId, productoId)))
      .limit(1);
    return fila?.marca ?? null;
  }

  /** Vínculos activos del producto con su presentación en tienda. */
  async vinculos(productoId: string): Promise<FilaVinculo[]> {
    return this.db
      .select({
        id: productoSupermercado.id,
        marca: productoSupermercado.marca,
        marcaNormalizada: productoSupermercado.marcaNormalizada,
        supermercado: supermercado.nombre,
        presentacionCantidad: productoSupermercado.presentacionCantidad,
        unidad: unidad.codigo,
      })
      .from(productoSupermercado)
      .innerJoin(supermercado, eq(supermercado.id, productoSupermercado.supermercadoId))
      .innerJoin(unidad, eq(unidad.id, productoSupermercado.presentacionUnidadId))
      .where(
        and(eq(productoSupermercado.productoId, productoId), eq(productoSupermercado.activo, true)),
      )
      .orderBy(asc(supermercado.nombre), asc(productoSupermercado.id));
  }

  /**
   * Precios de esos vínculos, el más reciente primero. Los manuales y de ticket son del hogar que
   * los registró (D-05): los de otro hogar no se ven.
   */
  async precios(hogarId: string, vinculoIds: string[]): Promise<FilaPrecio[]> {
    if (vinculoIds.length === 0) return [];
    return this.db
      .select({
        productoSupermercadoId: precio.productoSupermercadoId,
        precio: precio.precio,
        fechaPrecio: precio.fechaPrecio,
      })
      .from(precio)
      .where(
        and(
          inArray(precio.productoSupermercadoId, vinculoIds),
          or(isNull(precio.hogarId), eq(precio.hogarId, hogarId)),
        ),
      )
      .orderBy(desc(precio.fechaPrecio), desc(precio.createdAt));
  }

  /** Fija la marca preferida (upsert) o la quita (`null`). */
  async guardarMarca(
    hogarId: string,
    productoId: string,
    marca: { marca: string; marcaNormalizada: string } | null,
  ): Promise<void> {
    if (marca === null) {
      await this.db
        .delete(marcaPreferida)
        .where(and(eq(marcaPreferida.hogarId, hogarId), eq(marcaPreferida.productoId, productoId)));
      return;
    }
    await this.db
      .insert(marcaPreferida)
      .values({ hogarId, productoId, ...marca })
      .onConflictDoUpdate({
        target: [marcaPreferida.hogarId, marcaPreferida.productoId],
        set: { ...marca, updatedAt: new Date() },
      });
  }
}
