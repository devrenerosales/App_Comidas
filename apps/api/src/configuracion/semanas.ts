/**
 * Fechas de calendario en la zona de negocio America/Guatemala (R-02) para decidir desde qué
 * semana aplica un cambio de configuración (CU-02.3 paso 3). Las fechas son texto AAAA-MM-DD.
 */
export const ZONA_NEGOCIO = 'America/Guatemala';

/** Días en el orden de `Date#getUTCDay` (enum `dia_semana`). */
export const DIAS_SEMANA = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;

const formatoFecha = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Fecha de calendario de Guatemala del instante dado. */
export function fechaLocal(instante: Date): string {
  return formatoFecha.format(instante);
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Inicio de la próxima semana: el primer `diaInicio` estrictamente posterior a `hoy`
 * (CA-08.1: jueves 2026-10-22 con inicio domingo → 2026-10-25).
 */
export function inicioProximaSemana(hoy: string, diaInicio: string): string {
  const objetivo = Math.max(0, DIAS_SEMANA.indexOf(diaInicio as (typeof DIAS_SEMANA)[number]));
  const actual = new Date(`${hoy}T00:00:00.000Z`).getUTCDay();
  const delta = (objetivo - actual + 7) % 7 || 7;
  return sumarDias(hoy, delta);
}

/**
 * Primera semana que usa la configuración nueva: la próxima semana, saltando las semanas
 * consecutivas cubiertas por menús aprobados (D-04: los aprobados no cambian). CA-07.2: con el
 * menú del 2026-10-25 aprobado, la nueva configuración aplica desde el 2026-11-01.
 */
export function aplicaDesde(
  hoy: string,
  diaInicio: string,
  aprobados: readonly { fechaInicio: string; fechaFin: string }[],
): string {
  let desde = inicioProximaSemana(hoy, diaInicio);
  const ordenados = [...aprobados].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  for (const menu of ordenados) {
    if (menu.fechaInicio <= desde && menu.fechaFin >= desde) desde = sumarDias(menu.fechaFin, 1);
  }
  return desde;
}
