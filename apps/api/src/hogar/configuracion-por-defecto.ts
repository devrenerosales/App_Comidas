import { distribucionPorDefecto, ORDEN_TIEMPOS, TiempoComida } from '@menu/shared';

/**
 * Configuración inicial del hogar (supuesto de CU-01.2 y modelo-datos §8.4): solo almuerzo,
 * presupuesto semanal Q250 (S-01), semana de domingo a sábado y recordatorio el domingo a las 8.
 * Los pesos del motor y el umbral de similitud usan los valores por defecto del esquema.
 */
export const CONFIGURACION_POR_DEFECTO = {
  presupuestoSemanal: '250.00',
  diaInicioSemana: 'DOMINGO',
  diaPlanificacion: 'DOMINGO',
  horaPlanificacion: 8,
} as const;

/** Tiempos activos al crear el hogar. */
export const TIEMPOS_INICIALES: readonly TiempoComida[] = [TiempoComida.ALMUERZO];

/** Las tres filas de `tiempo_comida_config`: activas con su % de RN-06, inactivas en 0. */
export function tiemposPorDefecto(): {
  tiempo: TiempoComida;
  activo: boolean;
  porcentaje: string;
}[] {
  const distribucion = distribucionPorDefecto(TIEMPOS_INICIALES);
  return ORDEN_TIEMPOS.map((tiempo) => {
    const porcentaje = distribucion[tiempo];
    return {
      tiempo,
      activo: porcentaje !== undefined,
      porcentaje: (porcentaje ?? 0).toFixed(2),
    };
  });
}
