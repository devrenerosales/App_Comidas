import { randomUUID } from 'node:crypto';
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
  menuAlternativaMostrada,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloIngrediente,
  platilloTiempo,
  precioResumen,
  productoEquivalencia,
  producto,
  sql,
  unidad,
  usuario,
  type Db,
  type MenuDetalle,
  type MenuSemanal,
  type MenuTiempo,
} from '@menu/db';
import {
  aCentavos,
  deCentavos,
  type IngredienteCosto,
  type IngredienteDeComida,
  type ItemConsolidado,
  type MagnitudUnidad,
  type ProteinaPrincipal,
  type TiempoComida,
} from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import { promediosDeCompra } from '../listas/promedio-compra.consulta';

/** Ya existe un menú de esa semana para el hogar (índice único hogar + inicio). */
export class MenuDuplicadoError extends Error {
  constructor() {
    super('Menú duplicado');
  }
}

/** Platillo activo aplicable a un tiempo de comida, con lo que necesita el puntaje (CU-05.2). */
export interface PlatilloActivo {
  id: string;
  nombre: string;
  proteina: ProteinaPrincipal;
  favorito: boolean;
  calificacionPromedio: string | null;
  tiempo: TiempoComida;
}

/** Una preparación pasada de un platillo (menús históricos o aprobados). */
export interface Preparacion {
  platilloId: string;
  tiempo: TiempoComida;
  fecha: string;
}

export interface DetalleConPlatillo extends MenuDetalle {
  platilloNombre: string | null;
  platilloProteina: ProteinaPrincipal | null;
}

export interface MenuCompleto {
  menu: MenuSemanal;
  tiempos: MenuTiempo[];
  detalles: DetalleConPlatillo[];
  /** Quién aprobó el menú (null mientras es Borrador). */
  aprobadoPor?: { id: string; nombre: string } | null;
  /** Lista de compras creada al aprobar (null mientras es Borrador). */
  listaId?: string | null;
}

/** Lo que fija la aprobación del menú (CU-06.2 paso 4, D-03, D-04). */
export interface DatosAprobacion {
  usuarioId: string;
  aprobadoEn: Date;
  /** Suma de los excesos por tiempo, en texto con 2 decimales ("0.00" si está dentro). */
  excesoAlAprobar: string;
  /** Ítems consolidados de la lista de compras (CU-07.1, HU-28). */
  items: ItemConsolidado[];
}

export interface ListaCreada {
  id: string;
  version: number;
}

export interface FilaDetalleNueva {
  fecha: string;
  tiempo: TiempoComida;
  platilloId: string | null;
  /** MOTOR por defecto; REEMPLAZO_PRESUPUESTO cuando el ajuste cambió el platillo (RN-05). */
  origen?: MenuDetalle['origen'];
  reglasAplicadas?: string[];
  /** Detalle del reemplazo por presupuesto, p. ej. "Q22.00 más barato". */
  notas?: string | null;
  puntaje: string | null;
  factorPreferencia: string | null;
  factorNovedad: string | null;
  factorAhorro: string | null;
  factorAfinidad: string | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
}

export interface FilaTiempoNueva {
  tiempo: TiempoComida;
  porcentaje: string;
  presupuesto: string;
  costoEstimado: string | null;
  exceso: string;
  intentosAjuste?: number;
}

export interface DatosMenu {
  fechaFin: string;
  configuracionVersion: number;
  presupuestoSemanal: string;
  sumaFactoresPorcion: string;
  pesoPreferencia: string;
  pesoNovedad: string;
  pesoAhorro: string;
  pesoAfinidad: string;
  costoEstimado: string | null;
  costoIncompleto: boolean;
  generadoEn: Date;
}

/** Ingredientes de un platillo con los precios con que se costea (CU-05.3 paso 2). */
export interface DatosCostoPlatillo {
  porcionesBase: number;
  ingredientes: IngredienteCosto[];
}

/** Ingredientes de un platillo con lo que la lista de compras necesita (CU-07.1). */
export interface DatosListaPlatillo {
  porcionesBase: number;
  ingredientes: Omit<IngredienteDeComida, 'menuDetalleId'>[];
}

/** Platillo del hogar con los tiempos de comida en que aplica (RF-11). */
export interface PlatilloConTiempos {
  id: string;
  nombre: string;
  proteina: ProteinaPrincipal;
  activo: boolean;
  tiempos: TiempoComida[];
}

/** Campos de un espacio que cambian al editar, mover o fijar (CU-06.1). */
export type CambioDetalle = Partial<
  Pick<
    MenuDetalle,
    | 'platilloId'
    | 'fijado'
    | 'origen'
    | 'puntaje'
    | 'factorPreferencia'
    | 'factorNovedad'
    | 'factorAhorro'
    | 'factorAfinidad'
    | 'costoEstimado'
    | 'costoIncompleto'
    | 'reglasAplicadas'
    | 'notas'
    | 'modificadoPorId'
    | 'modificadoEn'
  >
>;

/** Acceso a menús semanales y a los datos que lee el motor (RNF-06: siempre por hogar). */
@Injectable()
export class MenusRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async menuDeSemana(hogarId: string, fechaInicio: string): Promise<MenuSemanal | undefined> {
    const [fila] = await this.db
      .select()
      .from(menuSemanal)
      .where(and(eq(menuSemanal.hogarId, hogarId), eq(menuSemanal.fechaInicio, fechaInicio)))
      .limit(1);
    return fila;
  }

  /** Menú del hogar con sus tiempos y espacios (null = otro hogar o inexistente). */
  async cargar(hogarId: string, menuId: string): Promise<MenuCompleto | undefined> {
    const [menu] = await this.db
      .select()
      .from(menuSemanal)
      .where(and(eq(menuSemanal.id, menuId), eq(menuSemanal.hogarId, hogarId)))
      .limit(1);
    if (!menu) return undefined;
    const tiempos = await this.db.select().from(menuTiempo).where(eq(menuTiempo.menuId, menuId));
    const detalles = await this.db
      .select({
        detalle: menuDetalle,
        platilloNombre: platillo.nombre,
        platilloProteina: platillo.proteinaPrincipal,
      })
      .from(menuDetalle)
      .leftJoin(platillo, eq(platillo.id, menuDetalle.platilloId))
      .where(eq(menuDetalle.menuId, menuId))
      .orderBy(asc(menuDetalle.fecha));
    const [aprobador] = menu.aprobadoPorId
      ? await this.db
          .select({ id: usuario.id, nombre: usuario.nombre })
          .from(usuario)
          .where(eq(usuario.id, menu.aprobadoPorId))
          .limit(1)
      : [];
    const [lista] = await this.db
      .select({ id: listaCompras.id })
      .from(listaCompras)
      .where(eq(listaCompras.menuId, menuId))
      .limit(1);
    return {
      menu,
      tiempos,
      aprobadoPor: aprobador ?? null,
      listaId: lista?.id ?? null,
      detalles: detalles.map((d) => ({
        ...d.detalle,
        platilloNombre: d.platilloNombre,
        platilloProteina: d.platilloProteina as ProteinaPrincipal | null,
      })),
    };
  }

  /**
   * Ingredientes de los platillos con su unidad, presentación, equivalencia y el precio mediana
   * del hogar (null si el producto aún no tiene precio). Un platillo sin ingredientes no aparece.
   */
  async ingredientesParaCosto(
    hogarId: string,
    platilloIds: string[],
  ): Promise<Map<string, DatosCostoPlatillo>> {
    const mapa = new Map<string, DatosCostoPlatillo>();
    if (platilloIds.length === 0) return mapa;
    const usada = alias(unidad, 'usada');
    const presentacion = alias(unidad, 'presentacion');
    const filas = await this.db
      .select({
        platilloId: platilloIngrediente.platilloId,
        productoId: platilloIngrediente.productoId,
        porcionesBase: platillo.porcionesBase,
        cantidad: platilloIngrediente.cantidad,
        usadaCodigo: usada.codigo,
        usadaMagnitud: usada.magnitud,
        usadaFactor: usada.factorBase,
        presCantidad: producto.presentacionCantidad,
        presCodigo: presentacion.codigo,
        presMagnitud: presentacion.magnitud,
        presFactor: presentacion.factorBase,
        equivalencia: productoEquivalencia.factor,
        precioMediana: precioResumen.precioMediana,
        precioDesactualizado: precioResumen.desactualizado,
      })
      .from(platilloIngrediente)
      .innerJoin(platillo, eq(platillo.id, platilloIngrediente.platilloId))
      .innerJoin(producto, eq(producto.id, platilloIngrediente.productoId))
      .innerJoin(usada, eq(usada.id, platilloIngrediente.unidadId))
      .innerJoin(presentacion, eq(presentacion.id, producto.presentacionUnidadId))
      .leftJoin(
        productoEquivalencia,
        and(
          eq(productoEquivalencia.productoId, producto.id),
          eq(productoEquivalencia.unidadId, platilloIngrediente.unidadId),
        ),
      )
      .leftJoin(
        precioResumen,
        and(eq(precioResumen.productoId, producto.id), eq(precioResumen.hogarId, hogarId)),
      )
      .where(inArray(platilloIngrediente.platilloId, platilloIds));
    // RN-08 y RN-12: sin precio vigente el costo usa el promedio de compra del hogar (CA-44.4).
    const promedios = await promediosDeCompra(
      this.db,
      hogarId,
      [...new Set(filas.map((f) => f.productoId))],
      new Date(),
    );
    for (const f of filas) {
      const datos = mapa.get(f.platilloId) ?? { porcionesBase: f.porcionesBase, ingredientes: [] };
      datos.ingredientes.push({
        cantidad: f.cantidad,
        unidad: {
          codigo: f.usadaCodigo,
          magnitud: f.usadaMagnitud as MagnitudUnidad,
          factorBase: f.usadaFactor,
        },
        presentacion: {
          cantidad: f.presCantidad,
          unidad: {
            codigo: f.presCodigo,
            magnitud: f.presMagnitud as MagnitudUnidad,
            factorBase: f.presFactor,
          },
        },
        equivalencia: f.equivalencia,
        precioMediana: f.precioMediana,
        precioDesactualizado: f.precioDesactualizado ?? false,
        precioDeCompra: promedios.get(f.productoId)?.promedio ?? null,
      });
      mapa.set(f.platilloId, datos);
    }
    return mapa;
  }

  /** Ingredientes con producto, unidades y presentación de compra para consolidar la lista (HU-28). */
  async ingredientesParaLista(platilloIds: string[]): Promise<Map<string, DatosListaPlatillo>> {
    const mapa = new Map<string, DatosListaPlatillo>();
    if (platilloIds.length === 0) return mapa;
    const usada = alias(unidad, 'usada');
    const presentacion = alias(unidad, 'presentacion');
    const filas = await this.db
      .select({
        platilloId: platilloIngrediente.platilloId,
        porcionesBase: platillo.porcionesBase,
        productoId: platilloIngrediente.productoId,
        cantidad: platilloIngrediente.cantidad,
        usadaId: usada.id,
        usadaCodigo: usada.codigo,
        usadaMagnitud: usada.magnitud,
        usadaFactor: usada.factorBase,
        presCantidad: producto.presentacionCantidad,
        presId: presentacion.id,
        presCodigo: presentacion.codigo,
        presMagnitud: presentacion.magnitud,
        presFactor: presentacion.factorBase,
        equivalencia: productoEquivalencia.factor,
      })
      .from(platilloIngrediente)
      .innerJoin(platillo, eq(platillo.id, platilloIngrediente.platilloId))
      .innerJoin(producto, eq(producto.id, platilloIngrediente.productoId))
      .innerJoin(usada, eq(usada.id, platilloIngrediente.unidadId))
      .innerJoin(presentacion, eq(presentacion.id, producto.presentacionUnidadId))
      .leftJoin(
        productoEquivalencia,
        and(
          eq(productoEquivalencia.productoId, producto.id),
          eq(productoEquivalencia.unidadId, platilloIngrediente.unidadId),
        ),
      )
      .where(inArray(platilloIngrediente.platilloId, platilloIds));
    for (const f of filas) {
      const datos = mapa.get(f.platilloId) ?? { porcionesBase: f.porcionesBase, ingredientes: [] };
      datos.ingredientes.push({
        productoId: f.productoId,
        cantidad: f.cantidad,
        porcionesBase: f.porcionesBase,
        unidad: {
          id: f.usadaId,
          codigo: f.usadaCodigo,
          magnitud: f.usadaMagnitud as MagnitudUnidad,
          factorBase: f.usadaFactor,
        },
        presentacion: {
          cantidad: f.presCantidad,
          unidad: {
            id: f.presId,
            codigo: f.presCodigo,
            magnitud: f.presMagnitud as MagnitudUnidad,
            factorBase: f.presFactor,
          },
        },
        equivalencia: f.equivalencia,
      });
      mapa.set(f.platilloId, datos);
    }
    return mapa;
  }

  /** Platillos activos del hogar con cada tiempo en que aplican. */
  async platillosActivos(hogarId: string): Promise<PlatilloActivo[]> {
    const filas = await this.db
      .select({
        id: platillo.id,
        nombre: platillo.nombre,
        proteina: platillo.proteinaPrincipal,
        favorito: platillo.favorito,
        calificacionPromedio: platillo.calificacionPromedio,
        tiempo: platilloTiempo.tiempo,
      })
      .from(platillo)
      .innerJoin(platilloTiempo, eq(platilloTiempo.platilloId, platillo.id))
      .where(and(eq(platillo.hogarId, hogarId), eq(platillo.activo, true)));
    return filas as PlatilloActivo[];
  }

  /** Comidas de menús históricos y aprobados anteriores a `antesDe` (insumo de Novedad y Afinidad). */
  async preparaciones(hogarId: string, antesDe: string): Promise<Preparacion[]> {
    const filas = await this.db
      .select({
        platilloId: menuDetalle.platilloId,
        tiempo: menuDetalle.tiempo,
        fecha: menuDetalle.fecha,
      })
      .from(menuDetalle)
      .innerJoin(menuSemanal, eq(menuSemanal.id, menuDetalle.menuId))
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          inArray(menuSemanal.estado, ['HISTORICO', 'APROBADO']),
          sql`${menuDetalle.fecha} < ${antesDe}::date`,
          sql`${menuDetalle.platilloId} IS NOT NULL`,
        ),
      );
    return filas as Preparacion[];
  }

  /** Espacios fijados del menú (RF-24), con el platillo para conservarlos al regenerar. */
  async fijados(menuId: string): Promise<DetalleConPlatillo[]> {
    const filas = await this.db
      .select({
        detalle: menuDetalle,
        platilloNombre: platillo.nombre,
        platilloProteina: platillo.proteinaPrincipal,
      })
      .from(menuDetalle)
      .innerJoin(platillo, eq(platillo.id, menuDetalle.platilloId))
      .where(and(eq(menuDetalle.menuId, menuId), eq(menuDetalle.fijado, true)));
    return filas.map((d) => ({
      ...d.detalle,
      platilloNombre: d.platilloNombre,
      platilloProteina: d.platilloProteina as ProteinaPrincipal,
    }));
  }

  /** Crea el menú Borrador con sus tiempos y espacios en una transacción. */
  async crear(
    hogarId: string,
    fechaInicio: string,
    datos: DatosMenu,
    tiempos: FilaTiempoNueva[],
    detalles: FilaDetalleNueva[],
  ): Promise<string> {
    try {
      return await this.db.transaction(async (tx) => {
        const [fila] = await tx
          .insert(menuSemanal)
          .values({ hogarId, fechaInicio, estado: 'BORRADOR', origen: 'MOTOR', ...datos })
          .returning({ id: menuSemanal.id });
        const menuId = (fila as { id: string }).id;
        await tx.insert(menuTiempo).values(tiempos.map((t) => ({ menuId, ...t })));
        await tx.insert(menuDetalle).values(detalles.map((d) => ({ menuId, ...d })));
        return menuId;
      });
    } catch (error) {
      if (esViolacionUnicidad(error)) throw new MenuDuplicadoError();
      throw error;
    }
  }

  /**
   * Regenera un Borrador: conserva los espacios fijados que siguen siendo válidos, reemplaza el
   * resto y vuelve a guardar la copia de configuración (CU-05.1 1a).
   */
  async regenerar(
    menuId: string,
    versionActual: number,
    datos: DatosMenu,
    tiempos: FilaTiempoNueva[],
    conservar: string[],
    detalles: FilaDetalleNueva[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(menuSemanal)
        .set({ ...datos, desactualizado: false, version: versionActual + 1 })
        .where(eq(menuSemanal.id, menuId));
      await tx.delete(menuTiempo).where(eq(menuTiempo.menuId, menuId));
      await tx.insert(menuTiempo).values(tiempos.map((t) => ({ menuId, ...t })));
      const aConservar = conservar.length
        ? sql`${menuDetalle.id} NOT IN (${sql.join(
            conservar.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`
        : sql`true`;
      await tx.delete(menuDetalle).where(and(eq(menuDetalle.menuId, menuId), aConservar));
      if (detalles.length > 0) {
        await tx.insert(menuDetalle).values(detalles.map((d) => ({ menuId, ...d })));
      }
    });
  }

  /** Menú del hogar cuya semana contiene `fecha` (null = no hay menú para esa fecha). */
  async cargarPorFecha(hogarId: string, fecha: string): Promise<MenuCompleto | undefined> {
    const [menu] = await this.db
      .select({ id: menuSemanal.id })
      .from(menuSemanal)
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          sql`${menuSemanal.fechaInicio} <= ${fecha}::date`,
          sql`${menuSemanal.fechaFin} >= ${fecha}::date`,
        ),
      )
      .limit(1);
    return menu ? this.cargar(hogarId, menu.id) : undefined;
  }

  /**
   * CU-06.1 paso 4: vuelve a sumar el costo de cada tiempo y del menú con los espacios que quedaron
   * (los de costo incompleto aportan Q0.00 y marcan el menú, D-18) y recalcula el exceso por tiempo.
   */
  private async recalcularCostos(tx: Pick<Db, 'select' | 'update'>, menuId: string): Promise<void> {
    const detalles = await tx
      .select({
        tiempo: menuDetalle.tiempo,
        platilloId: menuDetalle.platilloId,
        costoEstimado: menuDetalle.costoEstimado,
        costoIncompleto: menuDetalle.costoIncompleto,
      })
      .from(menuDetalle)
      .where(eq(menuDetalle.menuId, menuId));
    const tiempos = await tx.select().from(menuTiempo).where(eq(menuTiempo.menuId, menuId));
    let totalMenu = 0;
    let algunoConocido = false;
    for (const t of tiempos) {
      const conocidos = detalles.filter((d) => d.tiempo === t.tiempo && d.costoEstimado !== null);
      const costo = conocidos.reduce((s, d) => s + (aCentavos(d.costoEstimado!) ?? 0), 0);
      const exceso = Math.max(0, costo - (aCentavos(t.presupuesto) ?? 0));
      totalMenu += costo;
      algunoConocido ||= conocidos.length > 0;
      await tx
        .update(menuTiempo)
        .set({
          costoEstimado: conocidos.length > 0 ? deCentavos(costo) : null,
          exceso: deCentavos(exceso),
        })
        .where(eq(menuTiempo.id, t.id));
    }
    await tx
      .update(menuSemanal)
      .set({
        costoEstimado: algunoConocido ? deCentavos(totalMenu) : null,
        costoIncompleto: detalles.some((d) => d.platilloId !== null && d.costoIncompleto),
      })
      .where(eq(menuSemanal.id, menuId));
  }

  /** Platillos que ya se ofrecieron como alternativa para el espacio (CU-05.5 paso 3). */
  async alternativasMostradas(detalleId: string): Promise<string[]> {
    const filas = await this.db
      .select({ platilloId: menuAlternativaMostrada.platilloId })
      .from(menuAlternativaMostrada)
      .where(eq(menuAlternativaMostrada.menuDetalleId, detalleId));
    return filas.map((f) => f.platilloId);
  }

  /** Platillo del hogar (otro hogar = no existe, RNF-06) con sus tiempos aplicables. */
  async platillo(hogarId: string, id: string): Promise<PlatilloConTiempos | undefined> {
    const [fila] = await this.db
      .select({
        id: platillo.id,
        nombre: platillo.nombre,
        proteina: platillo.proteinaPrincipal,
        activo: platillo.activo,
      })
      .from(platillo)
      .where(and(eq(platillo.id, id), eq(platillo.hogarId, hogarId)))
      .limit(1);
    if (!fila) return undefined;
    const tiempos = await this.tiemposDe([id]);
    return {
      ...fila,
      proteina: fila.proteina as ProteinaPrincipal,
      tiempos: tiempos.get(id) ?? [],
    };
  }

  /** Tiempos aplicables por platillo. */
  async tiemposDe(ids: string[]): Promise<Map<string, TiempoComida[]>> {
    const mapa = new Map<string, TiempoComida[]>();
    if (ids.length === 0) return mapa;
    const filas = await this.db
      .select({ platilloId: platilloTiempo.platilloId, tiempo: platilloTiempo.tiempo })
      .from(platilloTiempo)
      .where(inArray(platilloTiempo.platilloId, ids));
    for (const f of filas) {
      mapa.set(f.platilloId, [...(mapa.get(f.platilloId) ?? []), f.tiempo as TiempoComida]);
    }
    return mapa;
  }

  /**
   * Aplica los cambios a los espacios en una transacción y vuelve a calcular si el costo del menú
   * está incompleto (CU-06.1 paso 4; sin precios siempre lo está).
   */
  async aplicarCambios(
    menuId: string,
    cambios: { id: string; cambio: CambioDetalle }[],
    mostradas: { detalleId: string; platilloId: string }[] = [],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (const { id, cambio } of cambios) {
        await tx
          .update(menuDetalle)
          .set(cambio)
          .where(and(eq(menuDetalle.id, id), eq(menuDetalle.menuId, menuId)));
      }
      if (mostradas.length > 0) {
        await tx
          .insert(menuAlternativaMostrada)
          .values(mostradas.map((m) => ({ menuDetalleId: m.detalleId, platilloId: m.platilloId })))
          .onConflictDoNothing();
      }
      await this.recalcularCostos(tx, menuId);
    });
  }

  /**
   * Aprueba el Borrador y crea la lista de compras de la semana en una sola transacción
   * (CU-06.2 paso 4; E2: si algo falla, el menú sigue en Borrador). Devuelve `undefined` si el
   * menú ya no es un Borrador de esa versión (otro miembro lo cambió antes).
   */
  async aprobar(
    hogarId: string,
    menuId: string,
    version: number,
    datos: DatosAprobacion,
  ): Promise<ListaCreada | undefined> {
    return this.db.transaction(async (tx) => {
      const [aprobado] = await tx
        .update(menuSemanal)
        .set({
          estado: 'APROBADO',
          aprobadoPorId: datos.usuarioId,
          aprobadoEn: datos.aprobadoEn,
          excesoAlAprobar: datos.excesoAlAprobar,
          version: version + 1,
        })
        .where(
          and(
            eq(menuSemanal.id, menuId),
            eq(menuSemanal.hogarId, hogarId),
            eq(menuSemanal.estado, 'BORRADOR'),
            eq(menuSemanal.version, version),
          ),
        )
        .returning({ id: menuSemanal.id });
      if (!aprobado) return undefined;
      const [lista] = await tx
        .insert(listaCompras)
        .values({ hogarId, menuId, generadaEn: datos.aprobadoEn })
        .returning({ id: listaCompras.id, version: listaCompras.version });
      await this.insertarItems(tx, lista!.id, datos.items, datos.aprobadoEn);
      return lista as ListaCreada;
    });
  }

  /** Guarda los ítems consolidados con origen "Menú" y las comidas que los originan (CU-07.1 paso 8). */
  private async insertarItems(
    tx: Pick<Db, 'insert'>,
    listaId: string,
    items: ItemConsolidado[],
    creadoEn: Date,
  ): Promise<void> {
    if (items.length === 0) return;
    const filas = items.map((i) => ({ ...i, id: randomUUID() }));
    await tx.insert(listaItem).values(
      filas.map((i) => ({
        id: i.id,
        listaId,
        productoId: i.productoId,
        origen: 'MENU' as const,
        cantidadRequerida: i.cantidadRequerida === null ? null : String(i.cantidadRequerida),
        unidadRequeridaId: i.unidadRequeridaId,
        cantidadComprar: String(i.cantidadComprar),
        sinConversion: i.sinConversion,
        modificadoEnDispositivo: creadoEn,
      })),
    );
    await tx.insert(listaItemOrigen).values(
      filas.flatMap((i) =>
        i.origenes.map((o) => ({
          listaItemId: i.id,
          menuDetalleId: o.menuDetalleId,
          cantidadRequerida: o.cantidadRequerida === null ? null : String(o.cantidadRequerida),
        })),
      ),
    );
  }
}
