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
export interface PlatilloPorResolver {
  nombreOriginal: string;
  nombreNormalizado: string;
  proteinaPrincipal: string | null;
  decision: 'PENDIENTE' | 'ASOCIAR' | 'CREAR';
  automatica: boolean;
  propuesta: {
    accion: 'ASOCIAR' | 'CREAR';
    platilloId: string | null;
    platillo: string | null;
    /** De 0 a 1; null si el catálogo no tiene nada parecido. */
    similitud: number | null;
  };
  platilloId: string | null;
  platillo: string | null;
  nombreFinal: string | null;
}
export interface DecisionPlatillo {
  nombreNormalizado: string;
  decision: 'ASOCIAR' | 'CREAR';
  platilloId?: string;
  nombreFinal?: string;
}
export type PaginaPlatillosImportados = Pagina<PlatilloPorResolver> & {
  resumen: { total: number; pendientes: number };
};
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
    platillos: (id: string, estado: 'pendientes' | 'revisar' | 'todos', pagina = 1) =>
      http.peticion<PaginaPlatillosImportados>(
        `/importaciones/${id}/platillos?estado=${estado}&pagina=${pagina}`,
      ),
    decidirPlatillos: (
      id: string,
      revision: string,
      cuerpo: { aceptarPropuestas?: boolean; decisiones?: DecisionPlatillo[] },
    ) =>
      http.peticion<VistaImportacion>(`/importaciones/${id}/platillos`, {
        metodo: 'PUT',
        cuerpo: { revision, ...cuerpo },
      }),
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
