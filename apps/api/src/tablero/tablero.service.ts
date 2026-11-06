import { Inject, Injectable } from '@nestjs/common';
import { fechaLocal } from '../configuracion/semanas';
import { RELOJ_TABLERO } from './tablero.constants';
import { TableroRepositorio, type SemanaTablero } from './tablero.repositorio';

export interface VistaSemanaTablero {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: string;
  /** null en semanas históricas capturadas sin presupuesto. */
  presupuesto: string | null;
  costoEstimado: string | null;
  gastoReal: string | null;
}

export interface VistaTablero {
  hoy: string;
  semanaActual:
    | (VistaSemanaTablero & {
        comidasPlanificadas: number;
        comidasHastaHoy: number;
        costoEstimadoHastaHoy: string;
      })
    | null;
  historial: VistaSemanaTablero[];
}

const PERIODO_MAX = 26;
const PERIODO_DEFECTO = 8;

const vistaSemana = (s: SemanaTablero): VistaSemanaTablero => ({
  id: s.id,
  fechaInicio: s.fechaInicio,
  fechaFin: s.fechaFin,
  estado: s.estado,
  presupuesto: s.presupuestoSemanal,
  costoEstimado: s.costoEstimado,
  gastoReal: s.gastoReal,
});

/** Datos del Inicio: gasto y consumo de la semana en curso e historial de presupuesto. */
@Injectable()
export class TableroService {
  constructor(
    private readonly repo: TableroRepositorio,
    @Inject(RELOJ_TABLERO) private readonly reloj: () => Date,
  ) {}

  async obtener(hogarId: string, semanas?: string): Promise<VistaTablero> {
    const pedidas = Number(semanas);
    const limite =
      Number.isInteger(pedidas) && pedidas >= 1 ? Math.min(pedidas, PERIODO_MAX) : PERIODO_DEFECTO;
    const hoy = fechaLocal(this.reloj());
    const actual = await this.repo.semanaActual(hogarId, hoy);
    const consumo = actual && (await this.repo.consumo(actual.id, hoy));
    return {
      hoy,
      semanaActual:
        actual && consumo
          ? {
              ...vistaSemana(actual),
              comidasPlanificadas: consumo.planificadas,
              comidasHastaHoy: consumo.hastaHoy,
              costoEstimadoHastaHoy: consumo.costoHastaHoy,
            }
          : null,
      historial: (await this.repo.historial(hogarId, limite)).map(vistaSemana),
    };
  }
}
