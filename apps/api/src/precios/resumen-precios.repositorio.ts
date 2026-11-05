import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  hogarSupermercado,
  inArray,
  isNull,
  or,
  precio,
  precioResumen,
  productoSupermercado,
  supermercado,
  type Db,
} from '@menu/db';
import type { ResumenPrecios } from '@menu/shared';
import { DB } from '../database/database.constants';

/** Un precio visible para el hogar, con el producto al que pertenece. */
export interface FilaPrecioDeProducto {
  productoId: string;
  supermercadoId: string;
  supermercado: string;
  precio: string;
  fecha: string;
}

export interface ResumenGuardado extends ResumenPrecios {
  productoId: string;
  calculadoEn: Date;
}

/** Lectura de precios y escritura del resumen por producto y hogar (CU-09.2, RNF-06). */
@Injectable()
export class ResumenPreciosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Precios normalizados de vínculos activos que ve el hogar: los automáticos (comunes) y los
   * manuales o de ticket del propio hogar (D-05). El más reciente primero.
   */
  async precios(hogarId: string, productoId?: string): Promise<FilaPrecioDeProducto[]> {
    return this.db
      .select({
        productoId: productoSupermercado.productoId,
        supermercadoId: supermercado.id,
        supermercado: supermercado.nombre,
        precio: precio.precioNormalizado,
        fecha: precio.fechaPrecio,
      })
      .from(precio)
      .innerJoin(productoSupermercado, eq(productoSupermercado.id, precio.productoSupermercadoId))
      .innerJoin(supermercado, eq(supermercado.id, productoSupermercado.supermercadoId))
      .where(
        and(
          eq(productoSupermercado.activo, true),
          or(isNull(precio.hogarId), eq(precio.hogarId, hogarId)),
          productoId ? eq(productoSupermercado.productoId, productoId) : undefined,
        ),
      )
      .orderBy(desc(precio.fechaPrecio), desc(precio.createdAt));
  }

  /** Supermercados preferidos del hogar; `null` si todavía no eligió (valen todos, HU-09). */
  async preferidos(hogarId: string): Promise<Set<string> | null> {
    const filas = await this.db
      .select({
        supermercadoId: hogarSupermercado.supermercadoId,
        preferido: hogarSupermercado.preferido,
      })
      .from(hogarSupermercado)
      .where(eq(hogarSupermercado.hogarId, hogarId));
    if (filas.length === 0) return null;
    return new Set(filas.filter((f) => f.preferido).map((f) => f.supermercadoId));
  }

  async guardar(
    hogarId: string,
    productoId: string,
    resumen: ResumenPrecios,
    calculadoEn: Date,
  ): Promise<void> {
    const valores = {
      precioMediana: resumen.precioMediana,
      precioMinimo: resumen.precioMinimo,
      supermercadoMinimoId: resumen.supermercadoMinimoId,
      fechaPrecioMinimo: resumen.fechaPrecioMinimo,
      cantidadPrecios: resumen.cantidadPrecios,
      desactualizado: resumen.desactualizado,
      fechaPrecioMasAntiguo: resumen.fechaPrecioMasAntiguo,
      calculadoEn,
    };
    await this.db
      .insert(precioResumen)
      .values({ hogarId, productoId, ...valores })
      .onConflictDoUpdate({
        target: [precioResumen.productoId, precioResumen.hogarId],
        set: valores,
      });
  }

  /** E1: sin precios no hay resumen. */
  async eliminar(hogarId: string, productoId: string): Promise<void> {
    await this.db
      .delete(precioResumen)
      .where(and(eq(precioResumen.hogarId, hogarId), eq(precioResumen.productoId, productoId)));
  }

  /** Productos del hogar que hoy tienen resumen guardado. */
  async productosConResumen(hogarId: string): Promise<string[]> {
    const filas = await this.db
      .select({ productoId: precioResumen.productoId })
      .from(precioResumen)
      .where(eq(precioResumen.hogarId, hogarId));
    return filas.map((f) => f.productoId);
  }

  async eliminarVarios(hogarId: string, productoIds: string[]): Promise<void> {
    if (productoIds.length === 0) return;
    await this.db
      .delete(precioResumen)
      .where(
        and(eq(precioResumen.hogarId, hogarId), inArray(precioResumen.productoId, productoIds)),
      );
  }
}
