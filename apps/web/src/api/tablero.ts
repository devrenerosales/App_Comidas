/** Resumen del Inicio: gasto, consumo e historial de presupuesto. */
import type { ClienteHttp } from './cliente';

export interface SemanaTablero {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'APROBADO' | 'HISTORICO' | string;
  /** null en semanas históricas capturadas sin presupuesto. */
  presupuesto: string | null;
  costoEstimado: string | null;
  gastoReal: string | null;
}

export interface Tablero {
  hoy: string;
  semanaActual:
    | (SemanaTablero & {
        comidasPlanificadas: number;
        comidasHastaHoy: number;
        costoEstimadoHastaHoy: string;
      })
    | null;
  historial: SemanaTablero[];
}

export function crearApiTablero(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    obtener: (semanas = 8) => cliente.peticion<Tablero>(`/tablero?semanas=${semanas}`),
  };
}

export type ApiTablero = ReturnType<typeof crearApiTablero>;
