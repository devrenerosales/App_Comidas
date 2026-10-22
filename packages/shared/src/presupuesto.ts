import { ORDEN_TIEMPOS, TiempoComida } from './enums';

/** Porcentaje del presupuesto semanal asignado a cada tiempo de comida activo. */
export type DistribucionPresupuesto = Partial<Record<TiempoComida, number>>;

const { DESAYUNO, ALMUERZO, CENA } = TiempoComida;

/**
 * Tabla de RN-06. La clave es la combinación de tiempos activos en orden canónico.
 * Los valores son porcentajes enteros que suman 100.
 */
const TABLA_RN06: Readonly<Record<string, DistribucionPresupuesto>> = {
  [ALMUERZO]: { [ALMUERZO]: 100 },
  [`${ALMUERZO}+${CENA}`]: { [ALMUERZO]: 60, [CENA]: 40 },
  [`${DESAYUNO}+${ALMUERZO}`]: { [DESAYUNO]: 29, [ALMUERZO]: 71 },
  [`${DESAYUNO}+${CENA}`]: { [DESAYUNO]: 40, [CENA]: 60 },
  [`${DESAYUNO}+${ALMUERZO}+${CENA}`]: { [DESAYUNO]: 20, [ALMUERZO]: 50, [CENA]: 30 },
};

/**
 * RN-06 — Distribución por defecto del presupuesto semanal entre los tiempos de comida activos.
 *
 * - Solo almuerzo = 100 %
 * - Almuerzo + cena = 60/40
 * - Desayuno + almuerzo = 29/71
 * - Desayuno + cena = 40/60
 * - Tres tiempos = 20/50/30 (desayuno/almuerzo/cena)
 *
 * Los duplicados y el orden de entrada se ignoran. Combinaciones sin regla definida
 * (lista vacía, solo desayuno o solo cena) lanzan un error: el usuario debe activar
 * al menos una combinación válida (la distribución sigue siendo editable, D-01).
 */
export function distribucionPorDefecto(tiempos: readonly TiempoComida[]): DistribucionPresupuesto {
  const activos = ORDEN_TIEMPOS.filter((t) => tiempos.includes(t));
  const clave = activos.join('+');
  const distribucion = TABLA_RN06[clave];
  if (!distribucion) {
    throw new RangeError(
      `RN-06: no hay distribución por defecto para la combinación [${clave || 'vacía'}]`,
    );
  }
  return { ...distribucion };
}
