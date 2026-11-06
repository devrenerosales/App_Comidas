/**
 * Recálculo del mínimo y la mediana tras una corrida (CU-09.2, HU-33 paso 7). Para cada producto
 * que recibió un precio automático vuelve a calcular el resumen de los hogares que ya lo tienen,
 * con la misma regla pura que usa la API (`resumenPrecios`). Los demás hogares lo calculan al
 * registrar un precio, abrir su lista o generar un menú.
 */
import {
  and,
  eq,
  hogarSupermercado,
  precio,
  precioResumen,
  productoSupermercado,
  supermercado,
  type Db,
} from '@menu/db';
import { resumenPrecios, type PrecioDeSupermercado, type ResumenPrecios } from '@menu/shared';

export interface PrecioConHogar extends PrecioDeSupermercado {
  /** `null` = precio automático (común a todos los hogares). */
  hogarId: string | null;
}

export interface RepositorioRecalculo {
  productosDeCorrida(corridaId: string): Promise<string[]>;
  /** Precios normalizados de vínculos activos del producto: automáticos y de cualquier hogar. */
  preciosDelProducto(productoId: string): Promise<PrecioConHogar[]>;
  hogaresConResumen(productoId: string): Promise<string[]>;
  preferidos(hogarId: string): Promise<Set<string> | null>;
  guardar(
    hogarId: string,
    productoId: string,
    resumen: ResumenPrecios,
    calculadoEn: Date,
  ): Promise<void>;
  eliminar(hogarId: string, productoId: string): Promise<void>;
}

/** Recalcula los resúmenes afectados por la corrida; devuelve cuántos resúmenes se escribieron. */
export async function recalcularCorrida(
  repo: RepositorioRecalculo,
  corridaId: string,
  ahora: Date,
  hoy: string,
): Promise<number> {
  let escritos = 0;
  const preferidos = new Map<string, Set<string> | null>();
  for (const productoId of await repo.productosDeCorrida(corridaId)) {
    const [todos, hogares] = await Promise.all([
      repo.preciosDelProducto(productoId),
      repo.hogaresConResumen(productoId),
    ]);
    for (const hogarId of hogares) {
      if (!preferidos.has(hogarId)) preferidos.set(hogarId, await repo.preferidos(hogarId));
      const visibles = todos.filter((p) => p.hogarId === null || p.hogarId === hogarId);
      const resumen = resumenPrecios(visibles, hoy, preferidos.get(hogarId) ?? null);
      if (resumen) await repo.guardar(hogarId, productoId, resumen, ahora);
      else await repo.eliminar(hogarId, productoId);
      escritos += 1;
    }
  }
  return escritos;
}

/** Lecturas y escrituras del recálculo sobre PostgreSQL. */
export class RepositorioRecalculoPg implements RepositorioRecalculo {
  constructor(private readonly db: Db) {}

  async productosDeCorrida(corridaId: string): Promise<string[]> {
    const filas = await this.db
      .selectDistinct({ productoId: productoSupermercado.productoId })
      .from(precio)
      .innerJoin(productoSupermercado, eq(productoSupermercado.id, precio.productoSupermercadoId))
      .where(eq(precio.corridaId, corridaId));
    return filas.map((f) => f.productoId);
  }

  async preciosDelProducto(productoId: string): Promise<PrecioConHogar[]> {
    return this.db
      .select({
        hogarId: precio.hogarId,
        supermercadoId: supermercado.id,
        supermercado: supermercado.nombre,
        precio: precio.precioNormalizado,
        fecha: precio.fechaPrecio,
      })
      .from(precio)
      .innerJoin(productoSupermercado, eq(productoSupermercado.id, precio.productoSupermercadoId))
      .innerJoin(supermercado, eq(supermercado.id, productoSupermercado.supermercadoId))
      .where(
        and(eq(productoSupermercado.activo, true), eq(productoSupermercado.productoId, productoId)),
      );
  }

  async hogaresConResumen(productoId: string): Promise<string[]> {
    const filas = await this.db
      .select({ hogarId: precioResumen.hogarId })
      .from(precioResumen)
      .where(eq(precioResumen.productoId, productoId));
    return filas.map((f) => f.hogarId);
  }

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

  async eliminar(hogarId: string, productoId: string): Promise<void> {
    await this.db
      .delete(precioResumen)
      .where(and(eq(precioResumen.hogarId, hogarId), eq(precioResumen.productoId, productoId)));
  }
}
