import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lte, menuDetalle, menuSemanal, sql, type Db } from '@menu/db';
import { DB } from '../database/database.constants';

export interface SemanaTablero {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  presupuestoSemanal: string | null;
  costoEstimado: string | null;
  gastoReal: string | null;
}

export interface ConsumoSemana {
  /** Comidas con platillo asignado en toda la semana. */
  planificadas: number;
  /** De esas, las de días ya transcurridos (hasta hoy inclusive). */
  hastaHoy: number;
  /** Costo estimado de las comidas ya transcurridas. */
  costoHastaHoy: string;
}

/** M06 — lecturas del tablero de inicio (solo consulta). */
@Injectable()
export class TableroRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Semana que contiene la fecha, si tiene menú no Borrador. */
  async semanaActual(hogarId: string, hoy: string): Promise<SemanaTablero | null> {
    const [fila] = await this.db
      .select(columnas)
      .from(menuSemanal)
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          lte(menuSemanal.fechaInicio, hoy),
          sql`${menuSemanal.fechaFin} >= ${hoy}::date`,
        ),
      )
      .limit(1);
    return fila ?? null;
  }

  /** Semanas aprobadas o históricas más recientes (incluye la actual si ya está aprobada). */
  historial(hogarId: string, semanas: number): Promise<SemanaTablero[]> {
    return this.db
      .select(columnas)
      .from(menuSemanal)
      .where(
        and(
          eq(menuSemanal.hogarId, hogarId),
          inArray(menuSemanal.estado, ['APROBADO', 'HISTORICO']),
        ),
      )
      .orderBy(desc(menuSemanal.fechaInicio))
      .limit(semanas);
  }

  async consumo(menuId: string, hoy: string): Promise<ConsumoSemana> {
    const [fila] = await this.db
      .select({
        planificadas: sql<number>`count(*)::int`,
        hastaHoy: sql<number>`count(*) filter (where ${menuDetalle.fecha} <= ${hoy}::date)::int`,
        costoHastaHoy: sql<string>`coalesce(sum(${menuDetalle.costoEstimado}) filter (where ${menuDetalle.fecha} <= ${hoy}::date), 0)::numeric(12,2)::text`,
      })
      .from(menuDetalle)
      .where(and(eq(menuDetalle.menuId, menuId), sql`${menuDetalle.platilloId} is not null`));
    return fila ?? { planificadas: 0, hastaHoy: 0, costoHastaHoy: '0.00' };
  }
}

const columnas = {
  id: menuSemanal.id,
  fechaInicio: menuSemanal.fechaInicio,
  fechaFin: menuSemanal.fechaFin,
  estado: menuSemanal.estado,
  presupuestoSemanal: menuSemanal.presupuestoSemanal,
  costoEstimado: menuSemanal.costoEstimado,
  gastoReal: menuSemanal.gastoReal,
};
