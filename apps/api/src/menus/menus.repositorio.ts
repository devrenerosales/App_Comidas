import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  inArray,
  menuDetalle,
  menuSemanal,
  menuTiempo,
  platillo,
  platilloTiempo,
  sql,
  type Db,
  type MenuDetalle,
  type MenuSemanal,
  type MenuTiempo,
} from '@menu/db';
import type { ProteinaPrincipal, TiempoComida } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';

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
}

export interface FilaDetalleNueva {
  fecha: string;
  tiempo: TiempoComida;
  platilloId: string | null;
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
    return {
      menu,
      tiempos,
      detalles: detalles.map((d) => ({
        ...d.detalle,
        platilloNombre: d.platilloNombre,
        platilloProteina: d.platilloProteina as ProteinaPrincipal | null,
      })),
    };
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
}
