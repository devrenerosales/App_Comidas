import { createContext, useContext } from 'react';
import type { ClienteHttp } from './cliente';
import { cliente } from './index';
import type { Pagina } from './catalogo';
export interface ReporteImportacion {
  semanasCreadas: number;
  reemplazadas: number;
  omitidas: number;
  platillosCreados: number;
  aliasCreados: number;
  despensaCargada: number;
}
export interface VistaImportacion {
  id: string;
  nombreArchivo: string;
  estado: 'CON_ERRORES' | 'VISTA_PREVIA' | 'CONFIRMADA' | 'CANCELADA';
  revision: string | null;
  totalFilas: number;
  filasConError: number;
  pendientes: string[];
  semanas: {
    semanaInicio: string;
    fechaFin: string;
    decision: 'CREAR' | 'OMITIR' | 'REEMPLAZAR';
    gastoSemana: string | null;
    existente: { gastoReal: string | null; estado: string } | null;
    puedeReemplazar: boolean;
  }[];
  puedeConfirmar: boolean;
  reporte: ReporteImportacion | null;
}
export interface FilaImportacion {
  numeroFila: number;
  datos: { fecha: string; platillo: string; tiempo: string };
  errores: { columna: string; motivo: string }[];
}
export function crearApiImportaciones(http: Pick<ClienteHttp, 'peticion'>) {
  return {
    plantilla: (formato: 'csv' | 'xlsx') =>
      http.peticion<Blob>(`/importaciones/plantilla?formato=${formato}`, { respuesta: 'blob' }),
    cargar: (archivo: File) => {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('origen', 'ARCHIVO');
      return http.peticion<VistaImportacion>('/importaciones', { metodo: 'POST', cuerpo });
    },
    obtener: (id: string) => http.peticion<VistaImportacion>(`/importaciones/${id}`),
    filas: (id: string, pagina: number, soloErrores: boolean) =>
      http.peticion<Pagina<FilaImportacion>>(
        `/importaciones/${id}/filas?pagina=${pagina}&soloErrores=${soloErrores}`,
      ),
    decidir: (
      id: string,
      revision: string,
      semanaInicio: string,
      decision: 'OMITIR' | 'REEMPLAZAR',
    ) =>
      http.peticion<VistaImportacion>(`/importaciones/${id}/semanas`, {
        metodo: 'PUT',
        cuerpo: { revision, decisiones: [{ semanaInicio, decision }] },
      }),
    confirmar: (id: string, revision: string) =>
      http.peticion<ReporteImportacion>(`/importaciones/${id}/confirmar`, {
        metodo: 'POST',
        cuerpo: { revision },
      }),
    cancelar: (id: string, revision: string) =>
      http.peticion<VistaImportacion>(`/importaciones/${id}/cancelar`, {
        metodo: 'POST',
        cuerpo: { revision },
      }),
  };
}
export const ContextoApiImportaciones = createContext(crearApiImportaciones(cliente));
export const useApiImportaciones = () => useContext(ContextoApiImportaciones);
