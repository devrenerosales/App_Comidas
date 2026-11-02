import type { TiempoComida } from '@menu/shared';
import { NOMBRES_TIEMPO } from './nombres-catalogo';

/** Fecha de hoy (AAAA-MM-DD) en la zona de negocio America/Guatemala (R-02). */
export const hoyGuatemala = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Suma días a una fecha AAAA-MM-DD (calendario, sin zona horaria). */
export function sumarDiasFecha(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "01/11" para 2026-11-01. */
export const diaMes = (fecha: string): string => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** "Domingo 01/11" para una fecha AAAA-MM-DD. */
export function etiquetaDia(fecha: string): string {
  const dia = DIAS[new Date(`${fecha}T00:00:00.000Z`).getUTCDay()];
  return `${dia} ${diaMes(fecha)}`;
}

/** "01/11 al 07/11" para la semana que empieza en `desde`. */
export const etiquetaSemana = (desde: string): string =>
  `${diaMes(desde)} al ${diaMes(sumarDiasFecha(desde, 6))}`;

/** "Domingo 01/11 almuerzo": nombre accesible de un espacio día × tiempo. */
export const etiquetaEspacio = (d: { fecha: string; tiempo: TiempoComida }): string =>
  `${etiquetaDia(d.fecha)} ${NOMBRES_TIEMPO[d.tiempo].toLowerCase()}`;
