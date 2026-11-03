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
  sql,
  syncCambio,
  unidad,
  type Db,
} from '@menu/db';
import {
  resolverCambio,
  type CambioLista,
  type MagnitudUnidad,
  type ParcheItem,
  type ResultadoCambio,
} from '@menu/shared';
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

/** Resultado de un cambio del lote: lo que se devuelve y lo que queda registrado (idempotencia). */
export interface ResultadoSync {
  id: string;
  resultado: 'APLICADO' | 'OBSOLETO' | 'RECHAZADO';
  motivo?: string;
}

type Tx = Pick<Db, 'select' | 'insert' | 'update'>;

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

  /**
   * CU-07.3 pasos 4 y 5: aplica un lote de cambios en una transacción. Cada cambio se registra por su
   * id, así reenviarlo no repite nada; gana la marca de tiempo más reciente por ítem. Devuelve
   * undefined si la lista no existe o es de otro hogar (RNF-06).
   */
  async aplicarSync(
    hogarId: string,
    listaId: string,
    usuarioId: string,
    cambios: CambioLista[],
  ): Promise<{ resultados: ResultadoSync[] } | undefined> {
    return this.db.transaction(async (tx) => {
      // Bloquea la lista para que dos dispositivos que sincronizan a la vez no se pisen.
      const [lista] = await tx
        .select({ id: listaCompras.id })
        .from(listaCompras)
        .where(and(eq(listaCompras.id, listaId), eq(listaCompras.hogarId, hogarId)))
        .for('update');
      if (!lista) return undefined;

      const resultados: ResultadoSync[] = [];
      let hayAplicados = false;
      for (const cambio of cambios) {
        const { resultado, nuevo } = await this.aplicarCambio(tx, listaId, usuarioId, cambio);
        resultados.push(resultado);
        // Un cambio repetido devuelve lo ya resuelto y no cuenta como cambio de la lista.
        hayAplicados ||= nuevo && resultado.resultado === 'APLICADO';
      }
      if (hayAplicados) {
        await tx
          .update(listaCompras)
          .set({ version: sql`${listaCompras.version} + 1` })
          .where(eq(listaCompras.id, listaId));
      }
      return { resultados };
    });
  }

  private async aplicarCambio(
    tx: Tx,
    listaId: string,
    usuarioId: string,
    cambio: CambioLista,
  ): Promise<{ resultado: ResultadoSync; nuevo: boolean }> {
    const [previo] = await tx.select().from(syncCambio).where(eq(syncCambio.id, cambio.id));
    if (previo) {
      // Idempotencia: el mismo cambio devuelve lo que ya se resolvió, sin volver a aplicarlo.
      return {
        nuevo: false,
        resultado:
          previo.listaId === listaId
            ? { id: cambio.id, resultado: previo.resultado, motivo: previo.motivo ?? 'DUPLICADO' }
            : { id: cambio.id, resultado: 'RECHAZADO', motivo: 'ID_EN_USO' },
      };
    }

    let itemId = cambio.itemId;
    let [fila] = await tx.select().from(listaItem).where(eq(listaItem.id, itemId));
    let resultado: ResultadoCambio;
    if (fila && fila.listaId !== listaId) {
      resultado = { resultado: 'RECHAZADO', motivo: 'ITEM_NO_ENCONTRADO' };
    } else {
      const productoId = cambio.datos?.productoId ?? null;
      let productoInexistente = false;
      if (!fila && cambio.operacion === 'AGREGAR' && productoId) {
        // Un producto ya presente (aunque quitado) se reutiliza en lugar de duplicarlo.
        [fila] = await tx
          .select()
          .from(listaItem)
          .where(and(eq(listaItem.listaId, listaId), eq(listaItem.productoId, productoId)));
        if (fila) itemId = fila.id;
        else {
          const [existe] = await tx
            .select({ id: producto.id })
            .from(producto)
            .where(and(eq(producto.id, productoId), eq(producto.activo, true)));
          productoInexistente = !existe;
        }
      }
      resultado = productoInexistente
        ? { resultado: 'RECHAZADO', motivo: 'PRODUCTO_INVALIDO' }
        : resolverCambio(
            fila
              ? {
                  estado: fila.estado,
                  cantidadComprar: Number(fila.cantidadComprar),
                  eliminado: fila.eliminado,
                  modificadoEn: fila.modificadoEnDispositivo.getTime(),
                }
              : undefined,
            cambio,
          );
      if (resultado.resultado === 'APLICADO') {
        await this.aplicarParche(tx, listaId, itemId, !!fila, resultado.parche, usuarioId);
      }
    }

    const motivo = 'motivo' in resultado ? resultado.motivo : undefined;
    await tx.insert(syncCambio).values({
      id: cambio.id,
      listaId,
      itemId: cambio.itemId,
      usuarioId,
      operacion: cambio.operacion,
      datos: cambio.datos ?? null,
      marcaTiempoDispositivo: new Date(cambio.marcaTiempo),
      resultado: resultado.resultado,
      motivo: motivo ?? null,
    });
    return {
      nuevo: true,
      resultado: { id: cambio.id, resultado: resultado.resultado, ...(motivo ? { motivo } : {}) },
    };
  }

  private async aplicarParche(
    tx: Tx,
    listaId: string,
    itemId: string,
    existe: boolean,
    parche: ParcheItem,
    usuarioId: string,
  ): Promise<void> {
    const cubierto = parche.estado !== undefined && parche.estado !== 'PENDIENTE';
    const campos = {
      ...(parche.estado !== undefined ? { estado: parche.estado } : {}),
      ...(parche.cantidadComprar !== undefined
        ? { cantidadComprar: String(parche.cantidadComprar) }
        : {}),
      ...(parche.eliminado !== undefined ? { eliminado: parche.eliminado } : {}),
      ...(parche.compradoEn !== undefined
        ? {
            compradoEn: parche.compradoEn === null ? null : new Date(parche.compradoEn),
            compradoPorId: cubierto ? usuarioId : null,
          }
        : {}),
      // El precio real solo existe en ítems comprados (restricción lista_item_precio_ck).
      ...(parche.estado !== undefined && parche.estado !== 'COMPRADO'
        ? { precioReal: null, contenidoComprado: null, precioNormalizado: null }
        : {}),
      modificadoEnDispositivo: new Date(parche.modificadoEn),
    };
    if (existe) {
      await tx
        .update(listaItem)
        .set({ ...campos, version: sql`${listaItem.version} + 1` })
        .where(and(eq(listaItem.id, itemId), eq(listaItem.listaId, listaId)));
      return;
    }
    await tx.insert(listaItem).values({
      id: itemId,
      listaId,
      productoId: parche.productoId ?? null,
      textoLibre: parche.textoLibre ?? null,
      origen: 'MANUAL',
      cantidadComprar: String(parche.cantidadComprar),
      ...campos,
    });
  }
}
