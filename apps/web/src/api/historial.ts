import type { DetalleHistorico } from '@menu/shared';
import type { ClienteHttp } from './cliente';
import { consulta, type Pagina } from './catalogo';

export interface SemanaHistorica {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'HISTORICO';
  origen: string;
  gastoReal: string | null;
  notas: string | null;
  version: number;
  detalles: (Omit<DetalleHistorico, 'notas'> & { nombre: string | null; notas?: string | null })[];
}
export interface DatosCapturarSemana {
  fechaInicio: string;
  detalles: DetalleHistorico[];
  gastoReal?: string;
  notas?: string;
  reemplazar?: boolean;
  version?: number;
}
export function crearApiHistorial(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    listar: (filtros: { desde?: string; hasta?: string; pagina?: number } = {}) =>
      cliente.peticion<Pagina<SemanaHistorica>>(`/historial/semanas${consulta(filtros)}`),
    capturar: (datos: DatosCapturarSemana) =>
      cliente.peticion<Omit<SemanaHistorica, 'detalles'>>('/historial/semanas', {
        metodo: 'POST',
        cuerpo: datos,
      }),
  };
}
export type ApiHistorial = ReturnType<typeof crearApiHistorial>;
