import { Inject, Injectable } from '@nestjs/common';
import { and, calificacion, eq, menuDetalle, menuSemanal, type Db } from '@menu/db';
import { DB } from '../database/database.constants';
import { recalcularPromedios } from './promedios';

export interface DetalleParaCalificar {
  id: string;
  fecha: string;
  platilloId: string | null;
  estadoMenu: 'BORRADOR' | 'APROBADO' | 'HISTORICO';
}

export interface PromedioPlatillo {
  id: string;
  calificacionPromedio: string | null;
  calificacionConteo: number;
}

/** Acceso a calificaciones de comidas del hogar (RNF-06: siempre por hogar). */
@Injectable()
export class CalificacionesRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** El espacio solo si pertenece al menú y el menú al hogar (otro hogar = no existe). */
  async buscarDetalle(
    hogarId: string,
    menuId: string,
    detalleId: string,
  ): Promise<DetalleParaCalificar | undefined> {
    const [fila] = await this.db
      .select({
        id: menuDetalle.id,
        fecha: menuDetalle.fecha,
        platilloId: menuDetalle.platilloId,
        estadoMenu: menuSemanal.estado,
      })
      .from(menuDetalle)
      .innerJoin(menuSemanal, eq(menuSemanal.id, menuDetalle.menuId))
      .where(
        and(
          eq(menuDetalle.id, detalleId),
          eq(menuDetalle.menuId, menuId),
          eq(menuSemanal.hogarId, hogarId),
        ),
      )
      .limit(1);
    return fila;
  }

  /** Crea o reemplaza la calificación del espacio y recalcula promedio y conteo del platillo. */
  async guardar(
    detalleId: string,
    platilloId: string,
    usuarioId: string,
    valor: number,
  ): Promise<PromedioPlatillo> {
    return this.db.transaction(async (tx) => {
      await tx
        .insert(calificacion)
        .values({ menuDetalleId: detalleId, platilloId, usuarioId, valor })
        .onConflictDoUpdate({
          target: calificacion.menuDetalleId,
          set: { valor, usuarioId, platilloId, updatedAt: new Date() },
        });
      const [fila] = await recalcularPromedios(tx, [platilloId]);
      return fila as PromedioPlatillo;
    });
  }
}
