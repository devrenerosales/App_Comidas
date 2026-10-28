import { aCentavos } from './configuracion';
import type { TiempoComida } from './enums';

export interface DetalleHistorico {
  fecha: string;
  tiempo: TiempoComida;
  platilloId: string;
  notas?: string;
}
export interface CapturaHistorica {
  fechaInicio: string;
  detalles: readonly DetalleHistorico[];
  gastoReal?: string | null;
}
export interface FallaHistorial {
  codigo: string;
  mensaje: string;
  campo: string;
}

export function esFechaCalendario(fecha: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const ms = Date.parse(`${fecha}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === fecha;
}

/** Las semanas del cuaderno mantienen domingo–sábado, sin reinterpretar el pasado. */
export function diasSemanaHistorica(inicio: string): string[] {
  const ms = Date.parse(`${inicio}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(ms + i * 86_400_000).toISOString().slice(0, 10),
  );
}

export function validarCapturaHistorica(
  datos: CapturaHistorica,
  hoy: string,
): FallaHistorial | null {
  const error = (codigo: string, mensaje: string, campo: string) => ({ codigo, mensaje, campo });
  if (
    !esFechaCalendario(datos.fechaInicio) ||
    new Date(`${datos.fechaInicio}T00:00:00Z`).getUTCDay() !== 0
  )
    return error(
      'INICIO_SEMANA_INVALIDO',
      'Elige un domingo válido para iniciar la semana histórica',
      'fechaInicio',
    );
  const dias = diasSemanaHistorica(datos.fechaInicio);
  if (dias[6]! >= hoy)
    return error(
      'SEMANA_NO_TERMINADA',
      'Solo se pueden capturar semanas terminadas',
      'fechaInicio',
    );
  if (!datos.detalles.length)
    return error('SIN_PLATILLOS', 'Registra al menos un platillo', 'detalles');
  const espacios = new Set<string>();
  for (const d of datos.detalles) {
    if (!dias.includes(d.fecha))
      return error(
        'FECHA_FUERA_DE_SEMANA',
        'Cada platillo debe pertenecer a la semana elegida',
        'detalles',
      );
    const clave = `${d.fecha}:${d.tiempo}`;
    if (espacios.has(clave))
      return error('COMIDA_DUPLICADA', 'No repitas un día y tiempo de comida', 'detalles');
    espacios.add(clave);
  }
  if (datos.gastoReal !== undefined && datos.gastoReal !== null) {
    const centavos = aCentavos(datos.gastoReal);
    if (centavos === null || centavos <= 0 || centavos > 9_999_999)
      return error(
        'GASTO_INVALIDO',
        'El gasto debe ser un monto positivo en quetzales',
        'gastoReal',
      );
  }
  return null;
}
