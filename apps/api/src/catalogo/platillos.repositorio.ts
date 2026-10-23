import { Inject, Injectable } from '@nestjs/common';
import {
  alias,
  and,
  asc,
  categoria,
  comensal,
  eq,
  etiqueta,
  inArray,
  ne,
  platillo,
  platilloEtiqueta,
  platilloIngrediente,
  platilloTiempo,
  producto,
  productoEquivalencia,
  sql,
  unidad,
  type Db,
  type Platillo,
  type SQL,
} from '@menu/db';
import type { MagnitudUnidad, ProteinaPrincipal, TiempoComida, TipoProducto } from '@menu/shared';
import { ORDEN_TIEMPOS } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import type { EstadoPlatillo } from './dto/catalogo.dto';
import { desplazamiento } from './paginacion';
import { coincideTexto, type FilaProducto } from './productos.repositorio';

/** Ya existe un platillo con el mismo nombre normalizado en el hogar (índice único). */
export class PlatilloDuplicadoError extends Error {
  constructor() {
    super('Platillo duplicado');
  }
}

export interface FiltrosPlatillos {
  /** Texto normalizado. */
  q?: string;
  tiempo?: TiempoComida;
  proteina?: ProteinaPrincipal;
  /** Etiqueta normalizada. */
  etiqueta?: string;
  ingrediente?: string;
  estado: EstadoPlatillo;
}

export interface DatosPlatillo {
  nombre: string;
  nombreNormalizado: string;
  proteinaPrincipal: ProteinaPrincipal;
  favorito?: boolean;
}

export interface EtiquetaNueva {
  nombre: string;
  nombreNormalizado: string;
}

/** Ingrediente con su producto (y la unidad de presentación) y la unidad usada. */
export interface FilaIngrediente {
  id: string;
  cantidad: string;
  producto: FilaProducto;
  unidadId: string;
  unidadCodigo: string;
  unidadNombre: string;
  unidadMagnitud: MagnitudUnidad;
  unidadFactorBase: string | null;
}

export interface ItemIngrediente {
  productoId: string;
  cantidad: string;
  unidadId: string;
}

/** Producto con lo necesario para validar un ingrediente (CU-03.2 E2). */
export interface ProductoParaIngrediente {
  id: string;
  nombre: string;
  activo: boolean;
  magnitud: MagnitudUnidad;
  unidadCodigo: string;
  /** Códigos de unidad con `producto_equivalencia`. */
  equivalencias: string[];
}

/** Acceso a platillos del hogar, sus tiempos, etiquetas e ingredientes (RNF-06: siempre por hogar). */
@Injectable()
export class PlatillosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  private condiciones(hogarId: string, f: FiltrosPlatillos): SQL | undefined {
    const c: SQL[] = [eq(platillo.hogarId, hogarId)];
    if (f.estado === 'INACTIVO') c.push(eq(platillo.activo, false));
    else c.push(eq(platillo.activo, true));
    if (f.estado === 'INCOMPLETO') c.push(eq(platillo.incompleto, true));
    if (f.proteina) c.push(eq(platillo.proteinaPrincipal, f.proteina));
    if (f.q) {
      c.push(coincideTexto(platillo.nombreNormalizado, f.q));
    }
    if (f.tiempo) {
      c.push(
        sql`EXISTS (SELECT 1 FROM ${platilloTiempo} WHERE ${platilloTiempo.platilloId} = ${platillo.id} AND ${platilloTiempo.tiempo} = ${f.tiempo})`,
      );
    }
    if (f.etiqueta) {
      c.push(
        sql`EXISTS (SELECT 1 FROM ${platilloEtiqueta} JOIN ${etiqueta} ON ${etiqueta.id} = ${platilloEtiqueta.etiquetaId} WHERE ${platilloEtiqueta.platilloId} = ${platillo.id} AND ${etiqueta.nombreNormalizado} = ${f.etiqueta})`,
      );
    }
    if (f.ingrediente) {
      c.push(
        sql`EXISTS (SELECT 1 FROM ${platilloIngrediente} WHERE ${platilloIngrediente.platilloId} = ${platillo.id} AND ${platilloIngrediente.productoId} = ${f.ingrediente})`,
      );
    }
    return and(...c);
  }

  /** CU-03.1 pasos 1–2: página de platillos del hogar; con texto, primero los más parecidos. */
  async listar(
    hogarId: string,
    filtros: FiltrosPlatillos,
    pagina: number,
    tamano: number,
  ): Promise<{ filas: Platillo[]; total: number }> {
    const donde = this.condiciones(hogarId, filtros);
    const orden = filtros.q
      ? [sql`word_similarity(${filtros.q}, ${platillo.nombreNormalizado}) DESC`]
      : [];
    const filas = await this.db
      .select()
      .from(platillo)
      .where(donde)
      .orderBy(...orden, asc(platillo.nombreNormalizado), asc(platillo.id))
      .limit(tamano)
      .offset(desplazamiento(pagina, tamano));
    const [conteo] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(platillo)
      .where(donde);
    return { filas, total: conteo?.total ?? 0 };
  }

  /** El platillo solo si es del hogar (otro hogar = no existe, RNF-06). */
  async buscar(hogarId: string, id: string): Promise<Platillo | undefined> {
    const [fila] = await this.db
      .select()
      .from(platillo)
      .where(and(eq(platillo.id, id), eq(platillo.hogarId, hogarId)))
      .limit(1);
    return fila;
  }

  /** CU-03.1 E3: mismo nombre normalizado en el hogar. */
  async buscarPorNombre(
    hogarId: string,
    nombreNormalizado: string,
    excluirId?: string,
  ): Promise<{ id: string; nombre: string } | undefined> {
    const c = [eq(platillo.hogarId, hogarId), eq(platillo.nombreNormalizado, nombreNormalizado)];
    if (excluirId) c.push(ne(platillo.id, excluirId));
    const [fila] = await this.db
      .select({ id: platillo.id, nombre: platillo.nombre })
      .from(platillo)
      .where(and(...c))
      .limit(1);
    return fila;
  }

  /** Tiempos por platillo en orden canónico. */
  async tiempos(ids: string[]): Promise<Map<string, TiempoComida[]>> {
    const mapa = new Map<string, TiempoComida[]>();
    if (ids.length === 0) return mapa;
    const filas = await this.db
      .select()
      .from(platilloTiempo)
      .where(inArray(platilloTiempo.platilloId, ids));
    for (const f of filas) {
      const lista = mapa.get(f.platilloId) ?? [];
      lista.push(f.tiempo as TiempoComida);
      mapa.set(f.platilloId, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => ORDEN_TIEMPOS.indexOf(a) - ORDEN_TIEMPOS.indexOf(b));
    }
    return mapa;
  }

  /** Etiquetas por platillo, alfabéticas. */
  async etiquetas(ids: string[]): Promise<Map<string, string[]>> {
    const mapa = new Map<string, string[]>();
    if (ids.length === 0) return mapa;
    const filas = await this.db
      .select({ platilloId: platilloEtiqueta.platilloId, nombre: etiqueta.nombre })
      .from(platilloEtiqueta)
      .innerJoin(etiqueta, eq(etiqueta.id, platilloEtiqueta.etiquetaId))
      .where(inArray(platilloEtiqueta.platilloId, ids))
      .orderBy(asc(etiqueta.nombreNormalizado));
    for (const f of filas) mapa.set(f.platilloId, [...(mapa.get(f.platilloId) ?? []), f.nombre]);
    return mapa;
  }

  /** Cuántos ingredientes con producto inactivo tiene cada platillo (CA-13.2). */
  async ingredientesInactivos(ids: string[]): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (ids.length === 0) return mapa;
    const filas = await this.db
      .select({ platilloId: platilloIngrediente.platilloId, n: sql<number>`count(*)::int` })
      .from(platilloIngrediente)
      .innerJoin(producto, eq(producto.id, platilloIngrediente.productoId))
      .where(and(inArray(platilloIngrediente.platilloId, ids), eq(producto.activo, false)))
      .groupBy(platilloIngrediente.platilloId);
    for (const f of filas) mapa.set(f.platilloId, f.n);
    return mapa;
  }

  /** Ingredientes del platillo con su producto (orden de captura). */
  async ingredientes(platilloId: string): Promise<FilaIngrediente[]> {
    const presentacion = alias(unidad, 'presentacion');
    const usada = alias(unidad, 'usada');
    const filas = await this.db
      .select({
        id: platilloIngrediente.id,
        cantidad: platilloIngrediente.cantidad,
        productoId: producto.id,
        productoNombre: producto.nombre,
        productoTipo: producto.tipo,
        unidadCompra: producto.unidadCompra,
        presentacionCantidad: producto.presentacionCantidad,
        productoActivo: producto.activo,
        categoriaId: categoria.id,
        categoriaCodigo: categoria.codigo,
        categoriaNombre: categoria.nombre,
        presId: presentacion.id,
        presCodigo: presentacion.codigo,
        presNombre: presentacion.nombre,
        presMagnitud: presentacion.magnitud,
        presFactor: presentacion.factorBase,
        unidadId: usada.id,
        unidadCodigo: usada.codigo,
        unidadNombre: usada.nombre,
        unidadMagnitud: usada.magnitud,
        unidadFactor: usada.factorBase,
      })
      .from(platilloIngrediente)
      .innerJoin(producto, eq(producto.id, platilloIngrediente.productoId))
      .innerJoin(categoria, eq(categoria.id, producto.categoriaId))
      .innerJoin(presentacion, eq(presentacion.id, producto.presentacionUnidadId))
      .innerJoin(usada, eq(usada.id, platilloIngrediente.unidadId))
      .where(eq(platilloIngrediente.platilloId, platilloId))
      .orderBy(asc(platilloIngrediente.createdAt), asc(platilloIngrediente.id));
    return filas.map((f) => ({
      id: f.id,
      cantidad: f.cantidad,
      producto: {
        id: f.productoId,
        nombre: f.productoNombre,
        tipo: f.productoTipo as TipoProducto,
        unidadCompra: f.unidadCompra,
        presentacionCantidad: f.presentacionCantidad,
        activo: f.productoActivo,
        categoriaId: f.categoriaId,
        categoriaCodigo: f.categoriaCodigo,
        categoriaNombre: f.categoriaNombre,
        unidadId: f.presId,
        unidadCodigo: f.presCodigo,
        unidadNombre: f.presNombre,
        unidadMagnitud: f.presMagnitud as MagnitudUnidad,
        unidadFactorBase: f.presFactor,
      },
      unidadId: f.unidadId,
      unidadCodigo: f.unidadCodigo,
      unidadNombre: f.unidadNombre,
      unidadMagnitud: f.unidadMagnitud as MagnitudUnidad,
      unidadFactorBase: f.unidadFactor,
    }));
  }

  /** Crea el platillo con sus tiempos y etiquetas en una transacción. */
  async crear(
    hogarId: string,
    datos: DatosPlatillo,
    tiempos: TiempoComida[],
    etiquetas: EtiquetaNueva[],
  ): Promise<string> {
    try {
      return await this.db.transaction(async (tx) => {
        const [fila] = await tx
          .insert(platillo)
          .values({ hogarId, ...datos })
          .returning({ id: platillo.id });
        const id = (fila as { id: string }).id;
        await tx
          .insert(platilloTiempo)
          .values(tiempos.map((tiempo) => ({ platilloId: id, tiempo })));
        await this.guardarEtiquetas(tx, hogarId, id, etiquetas);
        return id;
      });
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new PlatilloDuplicadoError();
      throw error;
    }
  }

  /** Actualiza los campos dados; tiempos y etiquetas se reemplazan si vienen. */
  async actualizar(
    hogarId: string,
    id: string,
    datos: Partial<DatosPlatillo>,
    tiempos?: TiempoComida[],
    etiquetas?: EtiquetaNueva[],
  ): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        if (Object.keys(datos).length > 0) {
          await tx
            .update(platillo)
            .set(datos)
            .where(and(eq(platillo.id, id), eq(platillo.hogarId, hogarId)));
        }
        if (tiempos) {
          await tx.delete(platilloTiempo).where(eq(platilloTiempo.platilloId, id));
          await tx
            .insert(platilloTiempo)
            .values(tiempos.map((tiempo) => ({ platilloId: id, tiempo })));
        }
        if (etiquetas) {
          await tx.delete(platilloEtiqueta).where(eq(platilloEtiqueta.platilloId, id));
          await this.guardarEtiquetas(tx, hogarId, id, etiquetas);
        }
      });
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new PlatilloDuplicadoError();
      throw error;
    }
  }

  /** Las etiquetas son del hogar (UK hogar + nombre normalizado): se reutilizan si existen. */
  private async guardarEtiquetas(
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
    hogarId: string,
    platilloId: string,
    etiquetas: EtiquetaNueva[],
  ): Promise<void> {
    if (etiquetas.length === 0) return;
    await tx
      .insert(etiqueta)
      .values(etiquetas.map((e) => ({ hogarId, ...e })))
      .onConflictDoNothing({ target: [etiqueta.hogarId, etiqueta.nombreNormalizado] });
    const filas = await tx
      .select({ id: etiqueta.id })
      .from(etiqueta)
      .where(
        and(
          eq(etiqueta.hogarId, hogarId),
          inArray(
            etiqueta.nombreNormalizado,
            etiquetas.map((e) => e.nombreNormalizado),
          ),
        ),
      );
    await tx
      .insert(platilloEtiqueta)
      .values(filas.map((e) => ({ platilloId, etiquetaId: e.id })))
      .onConflictDoNothing();
  }

  async cambiarActivo(hogarId: string, id: string, activo: boolean): Promise<boolean> {
    const filas = await this.db
      .update(platillo)
      .set({ activo })
      .where(and(eq(platillo.id, id), eq(platillo.hogarId, hogarId)))
      .returning({ id: platillo.id });
    return filas.length > 0;
  }

  /**
   * CU-03.2 paso 6: reemplaza los ingredientes en una transacción, guarda las porciones base y
   * marca `incompleto` si queda sin ingredientes.
   */
  async reemplazarIngredientes(
    hogarId: string,
    id: string,
    porcionesBase: number,
    items: ItemIngrediente[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(platillo)
        .set({ porcionesBase, incompleto: items.length === 0 })
        .where(and(eq(platillo.id, id), eq(platillo.hogarId, hogarId)));
      await tx.delete(platilloIngrediente).where(eq(platilloIngrediente.platilloId, id));
      if (items.length > 0) {
        // created_at creciente conserva el orden de captura al leerlos.
        const ahora = Date.now();
        await tx
          .insert(platilloIngrediente)
          .values(items.map((i, n) => ({ platilloId: id, ...i, createdAt: new Date(ahora + n) })));
      }
    });
  }

  /** Productos pedidos con su magnitud y equivalencias (para validar unidades). */
  async productosParaIngredientes(ids: string[]): Promise<Map<string, ProductoParaIngrediente>> {
    const mapa = new Map<string, ProductoParaIngrediente>();
    if (ids.length === 0) return mapa;
    const filas = await this.db
      .select({
        id: producto.id,
        nombre: producto.nombre,
        activo: producto.activo,
        magnitud: unidad.magnitud,
        unidadCodigo: unidad.codigo,
      })
      .from(producto)
      .innerJoin(unidad, eq(unidad.id, producto.presentacionUnidadId))
      .where(inArray(producto.id, ids));
    const equivalencias = await this.db
      .select({ productoId: productoEquivalencia.productoId, codigo: unidad.codigo })
      .from(productoEquivalencia)
      .innerJoin(unidad, eq(unidad.id, productoEquivalencia.unidadId))
      .where(inArray(productoEquivalencia.productoId, ids));
    for (const f of filas) {
      mapa.set(f.id, {
        ...f,
        magnitud: f.magnitud as MagnitudUnidad,
        equivalencias: equivalencias.filter((e) => e.productoId === f.id).map((e) => e.codigo),
      });
    }
    return mapa;
  }

  /** Σ factores de porción de los comensales activos del hogar (RN-07, D-02). */
  async sumaFactores(hogarId: string): Promise<number> {
    const [fila] = await this.db
      .select({ suma: sql<string | null>`sum(${comensal.factorPorcion})` })
      .from(comensal)
      .where(and(eq(comensal.hogarId, hogarId), eq(comensal.activo, true)));
    return Number(fila?.suma ?? 0);
  }
}
