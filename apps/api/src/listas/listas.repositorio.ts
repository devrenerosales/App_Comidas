import { Inject, Injectable } from '@nestjs/common';
import {
  alias,
  and,
  asc,
  eq,
  inArray,
  listaCompras,
  listaItem,
  listaItemOrigen,
  menuSemanal,
  producto,
  productoEquivalencia,
  unidad,
  type Db,
} from '@menu/db';
import type { MagnitudUnidad } from '@menu/shared';
import { DB } from '../database/database.constants';

export interface UnidadLista {
  id: string;
  codigo: string;
  magnitud: MagnitudUnidad;
  factorBase: string | null;
}

/** Un ítem vigente con lo necesario para mostrarlo (nombre, unidades y presentación). */
export interface ItemDeLista {
  id: string;
  productoId: string | null;
  textoLibre: string | null;
  productoNombre: string | null;
  origen: 'MENU' | 'DESPENSA' | 'MENU_Y_DESPENSA' | 'MANUAL';
  cantidadRequerida: string | null;
  unidadRequerida: UnidadLista | null;
  cantidadComprar: string;
  sinConversion: boolean;
  estado: 'PENDIENTE' | 'COMPRADO' | 'YA_LO_TENGO';
  unidadCompra: string | null;
  presentacionCantidad: string | null;
  presentacionUnidad: UnidadLista | null;
  equivalencia: string | null;
  /** Comidas (detalles del menú) que originan el ítem. */
  comidas: string[];
}

export interface ListaCompleta {
  id: string;
  menuId: string;
  version: number;
  fechaInicio: string;
  fechaFin: string;
  excesoAlAprobar: string | null;
  items: ItemDeLista[];
}

/** Acceso a datos de la lista de compras (M07). */
@Injectable()
export class ListasRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** La lista con sus ítems vigentes; undefined si no existe o es de otro hogar (RNF-06). */
  async cargar(hogarId: string, listaId: string): Promise<ListaCompleta | undefined> {
    const [lista] = await this.db
      .select({
        id: listaCompras.id,
        menuId: listaCompras.menuId,
        version: listaCompras.version,
        fechaInicio: menuSemanal.fechaInicio,
        fechaFin: menuSemanal.fechaFin,
        excesoAlAprobar: menuSemanal.excesoAlAprobar,
      })
      .from(listaCompras)
      .innerJoin(menuSemanal, eq(menuSemanal.id, listaCompras.menuId))
      .where(and(eq(listaCompras.id, listaId), eq(listaCompras.hogarId, hogarId)));
    if (!lista) return undefined;

    const requerida = alias(unidad, 'requerida');
    const presentacion = alias(unidad, 'presentacion');
    const filas = await this.db
      .select({
        id: listaItem.id,
        productoId: listaItem.productoId,
        textoLibre: listaItem.textoLibre,
        productoNombre: producto.nombre,
        origen: listaItem.origen,
        cantidadRequerida: listaItem.cantidadRequerida,
        requeridaId: requerida.id,
        requeridaCodigo: requerida.codigo,
        requeridaMagnitud: requerida.magnitud,
        requeridaFactor: requerida.factorBase,
        cantidadComprar: listaItem.cantidadComprar,
        sinConversion: listaItem.sinConversion,
        estado: listaItem.estado,
        unidadCompra: producto.unidadCompra,
        presentacionCantidad: producto.presentacionCantidad,
        presentacionId: presentacion.id,
        presentacionCodigo: presentacion.codigo,
        presentacionMagnitud: presentacion.magnitud,
        presentacionFactor: presentacion.factorBase,
        equivalencia: productoEquivalencia.factor,
      })
      .from(listaItem)
      .leftJoin(producto, eq(producto.id, listaItem.productoId))
      .leftJoin(requerida, eq(requerida.id, listaItem.unidadRequeridaId))
      .leftJoin(presentacion, eq(presentacion.id, producto.presentacionUnidadId))
      .leftJoin(
        productoEquivalencia,
        and(
          eq(productoEquivalencia.productoId, listaItem.productoId),
          eq(productoEquivalencia.unidadId, listaItem.unidadRequeridaId),
        ),
      )
      .where(and(eq(listaItem.listaId, listaId), eq(listaItem.eliminado, false)))
      .orderBy(asc(producto.nombre), asc(listaItem.textoLibre));

    const origenes = filas.length
      ? await this.db
          .select({
            itemId: listaItemOrigen.listaItemId,
            menuDetalleId: listaItemOrigen.menuDetalleId,
          })
          .from(listaItemOrigen)
          .where(
            inArray(
              listaItemOrigen.listaItemId,
              filas.map((f) => f.id),
            ),
          )
      : [];
    const comidas = new Map<string, string[]>();
    for (const o of origenes)
      comidas.set(o.itemId, [...(comidas.get(o.itemId) ?? []), o.menuDetalleId]);

    return {
      ...lista,
      items: filas.map((f) => ({
        id: f.id,
        productoId: f.productoId,
        textoLibre: f.textoLibre,
        productoNombre: f.productoNombre,
        origen: f.origen,
        cantidadRequerida: f.cantidadRequerida,
        unidadRequerida: f.requeridaId
          ? {
              id: f.requeridaId,
              codigo: f.requeridaCodigo!,
              magnitud: f.requeridaMagnitud as MagnitudUnidad,
              factorBase: f.requeridaFactor,
            }
          : null,
        cantidadComprar: f.cantidadComprar,
        sinConversion: f.sinConversion,
        estado: f.estado,
        unidadCompra: f.unidadCompra,
        presentacionCantidad: f.presentacionCantidad,
        presentacionUnidad: f.presentacionId
          ? {
              id: f.presentacionId,
              codigo: f.presentacionCodigo!,
              magnitud: f.presentacionMagnitud as MagnitudUnidad,
              factorBase: f.presentacionFactor,
            }
          : null,
        equivalencia: f.equivalencia,
        comidas: comidas.get(f.id) ?? [],
      })),
    };
  }
}
