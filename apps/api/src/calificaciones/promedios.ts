import { calificacion, inArray, platillo, sql, type Db } from '@menu/db';
import type { PromedioPlatillo } from './calificaciones.repositorio';

/**
 * Recalcula `calificacion_promedio` (2 decimales, null sin calificaciones) y `calificacion_conteo`
 * de los platillos dados a partir de la tabla `calificacion`. Se llama dentro de la transacción
 * que cambia las calificaciones para que el promedio nunca quede desfasado (RF-14).
 */
export async function recalcularPromedios(
  tx: Pick<Db, 'update'>,
  platilloIds: string[],
): Promise<PromedioPlatillo[]> {
  if (platilloIds.length === 0) return [];
  return tx
    .update(platillo)
    .set({
      calificacionPromedio: sql`(SELECT round(avg(c.valor)::numeric, 2) FROM ${calificacion} c WHERE c.platillo_id = ${platillo.id})`,
      calificacionConteo: sql`(SELECT count(*)::int FROM ${calificacion} c WHERE c.platillo_id = ${platillo.id})`,
    })
    .where(inArray(platillo.id, platilloIds))
    .returning({
      id: platillo.id,
      calificacionPromedio: platillo.calificacionPromedio,
      calificacionConteo: platillo.calificacionConteo,
    });
}
