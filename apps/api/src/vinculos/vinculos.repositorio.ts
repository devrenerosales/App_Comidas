import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  precio,
  producto,
  productoSupermercado,
  supermercado,
  unidad,
  type Db,
} from '@menu/db';
import { DB } from '../database/database.constants';

export interface FilaProducto {
  id: string;
  nombre: string;
  presentacionCantidad: string;
  unidad: {
    id: string;
    codigo: string;
    nombre: string;
    magnitud: 'MASA' | 'VOLUMEN' | 'CONTEO';
    factorBase: string | null;
  };
}

export interface FilaSupermercadoVinculo {
  id: string;
  nombre: string;
  dominio: string | null;
  soportaExtraccion: boolean;
}

export interface FilaUnidad {
  id: string;
  codigo: string;
  nombre: string;
  magnitud: 'MASA' | 'VOLUMEN' | 'CONTEO';
  factorBase: string | null;
}

/** Un vínculo con su supermercado y la unidad de su presentación. */
export interface FilaVinculoCompleto {
  id: string;
  productoId: string;
  supermercadoId: string;
  supermercado: string;
  nombreTienda: string;
  marca: string | null;
  presentacionCantidad: string;
  unidad: string;
  factor: string;
  url: string | null;
  sku: string | null;
  activo: boolean;
}

export interface FilaPrecioVinculo {
  productoSupermercadoId: string;
  precio: string;
  precioNormalizado: string;
  fechaPrecio: string;
  origen: 'AUTOMATICO' | 'MANUAL' | 'TICKET';
}

export interface DatosNuevoVinculo {
  productoId: string;
  supermercadoId: string;
  nombreTienda: string;
  marca: string | null;
  marcaNormalizada: string | null;
  presentacionCantidad: string;
  presentacionUnidadId: string;
  factor: string;
  url: string | null;
  sku: string | null;
  creadoPorHogarId: string;
  creadoPorUsuarioId: string;
}

export interface CambiosVinculo {
  nombreTienda?: string;
  marca?: string | null;
  marcaNormalizada?: string | null;
  url?: string | null;
  sku?: string | null;
}

const seleccionVinculo = {
  id: productoSupermercado.id,
  productoId: productoSupermercado.productoId,
  supermercadoId: productoSupermercado.supermercadoId,
  supermercado: supermercado.nombre,
  nombreTienda: productoSupermercado.nombreTienda,
  marca: productoSupermercado.marca,
  presentacionCantidad: productoSupermercado.presentacionCantidad,
  unidad: unidad.codigo,
  factor: productoSupermercado.factor,
  url: productoSupermercado.url,
  sku: productoSupermercado.sku,
  activo: productoSupermercado.activo,
};

/** Vínculos producto ↔ supermercado: son comunes a todos los hogares (D-05, CU-08.2). */
@Injectable()
export class VinculosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async producto(id: string): Promise<FilaProducto | null> {
    const [fila] = await this.db
      .select({
        id: producto.id,
        nombre: producto.nombre,
        presentacionCantidad: producto.presentacionCantidad,
        unidadId: unidad.id,
        unidadCodigo: unidad.codigo,
        unidadNombre: unidad.nombre,
        unidadMagnitud: unidad.magnitud,
        unidadFactorBase: unidad.factorBase,
      })
      .from(producto)
      .innerJoin(unidad, eq(unidad.id, producto.presentacionUnidadId))
      .where(eq(producto.id, id))
      .limit(1);
    if (!fila) return null;
    return {
      id: fila.id,
      nombre: fila.nombre,
      presentacionCantidad: fila.presentacionCantidad,
      unidad: {
        id: fila.unidadId,
        codigo: fila.unidadCodigo,
        nombre: fila.unidadNombre,
        magnitud: fila.unidadMagnitud,
        factorBase: fila.unidadFactorBase,
      },
    };
  }

  /** Supermercados activos, por nombre. */
  async supermercados(): Promise<FilaSupermercadoVinculo[]> {
    return this.db
      .select({
        id: supermercado.id,
        nombre: supermercado.nombre,
        dominio: supermercado.dominio,
        soportaExtraccion: supermercado.soportaExtraccion,
      })
      .from(supermercado)
      .where(eq(supermercado.activo, true))
      .orderBy(asc(supermercado.nombre), asc(supermercado.id));
  }

  async supermercado(id: string): Promise<FilaSupermercadoVinculo | null> {
    const [fila] = await this.db
      .select({
        id: supermercado.id,
        nombre: supermercado.nombre,
        dominio: supermercado.dominio,
        soportaExtraccion: supermercado.soportaExtraccion,
      })
      .from(supermercado)
      .where(and(eq(supermercado.id, id), eq(supermercado.activo, true)))
      .limit(1);
    return fila ?? null;
  }

  async unidad(id: string): Promise<FilaUnidad | null> {
    const [fila] = await this.db
      .select({
        id: unidad.id,
        codigo: unidad.codigo,
        nombre: unidad.nombre,
        magnitud: unidad.magnitud,
        factorBase: unidad.factorBase,
      })
      .from(unidad)
      .where(eq(unidad.id, id))
      .limit(1);
    return fila ?? null;
  }

  /** Todos los vínculos del producto, los activos primero. */
  async vinculosDe(productoId: string): Promise<FilaVinculoCompleto[]> {
    return this.db
      .select(seleccionVinculo)
      .from(productoSupermercado)
      .innerJoin(supermercado, eq(supermercado.id, productoSupermercado.supermercadoId))
      .innerJoin(unidad, eq(unidad.id, productoSupermercado.presentacionUnidadId))
      .where(eq(productoSupermercado.productoId, productoId))
      .orderBy(
        desc(productoSupermercado.activo),
        asc(supermercado.nombre),
        desc(productoSupermercado.createdAt),
        asc(productoSupermercado.id),
      );
  }

  async vinculo(id: string): Promise<FilaVinculoCompleto | null> {
    const [fila] = await this.db
      .select(seleccionVinculo)
      .from(productoSupermercado)
      .innerJoin(supermercado, eq(supermercado.id, productoSupermercado.supermercadoId))
      .innerJoin(unidad, eq(unidad.id, productoSupermercado.presentacionUnidadId))
      .where(eq(productoSupermercado.id, id))
      .limit(1);
    return fila ?? null;
  }

  /** El vínculo activo del producto en ese supermercado, si hay. */
  async vinculoActivo(productoId: string, supermercadoId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ id: productoSupermercado.id })
      .from(productoSupermercado)
      .where(
        and(
          eq(productoSupermercado.productoId, productoId),
          eq(productoSupermercado.supermercadoId, supermercadoId),
          eq(productoSupermercado.activo, true),
        ),
      )
      .limit(1);
    return fila?.id ?? null;
  }

  /**
   * Último precio de cada vínculo, el más reciente primero. Los manuales y de ticket son del
   * hogar que los registró (D-05): los de otro hogar no se ven.
   */
  async precios(hogarId: string, vinculoIds: string[]): Promise<FilaPrecioVinculo[]> {
    if (vinculoIds.length === 0) return [];
    return this.db
      .select({
        productoSupermercadoId: precio.productoSupermercadoId,
        precio: precio.precio,
        precioNormalizado: precio.precioNormalizado,
        fechaPrecio: precio.fechaPrecio,
        origen: precio.origen,
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

  /**
   * Inserta el vínculo activo; si `reemplazaId` viene, inactiva antes el anterior en la misma
   * transacción y conserva su histórico de precios (CA-35.3).
   */
  async crear(datos: DatosNuevoVinculo, reemplazaId: string | null): Promise<string> {
    return this.db.transaction(async (tx) => {
      if (reemplazaId) {
        await tx
          .update(productoSupermercado)
          .set({ activo: false, inactivadoEn: new Date() })
          .where(eq(productoSupermercado.id, reemplazaId));
      }
      const [fila] = await tx
        .insert(productoSupermercado)
        .values(datos)
        .returning({ id: productoSupermercado.id });
      return fila!.id;
    });
  }

  async actualizar(id: string, cambios: CambiosVinculo): Promise<void> {
    await this.db
      .update(productoSupermercado)
      .set({ ...cambios, updatedAt: new Date() })
      .where(eq(productoSupermercado.id, id));
  }
}
