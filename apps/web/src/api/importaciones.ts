import { createContext, useContext } from 'react';
import type { ClienteHttp } from './cliente';
import { cliente } from './index';
import type { Pagina } from './catalogo';
export interface ResumenLista {
  lista: string;
  tipo: 'DESPENSA' | 'COMPRAS';
  productos: number;
  /** Suma de los precios de la lista; null si ninguna fila lo trae. */
  total: string | null;
  /** Productos que no están en el catálogo y se crean al confirmar. */
  nuevos: number;
}
export interface ReporteImportacion {
  semanasCreadas: number;
  reemplazadas: number;
  omitidas: number;
  platillosCreados: number;
  aliasCreados: number;
  despensaCargada: number;
  productosCreados: number;
  gastoSemanal: { semanas: number; minimo: string; maximo: string; promedio: string } | null;
  listas: ResumenLista[];
}
export interface VistaImportacion {
  id: string;
  nombreArchivo: string;
  estado: 'CON_ERRORES' | 'VISTA_PREVIA' | 'CONFIRMADA' | 'CANCELADA';
  origen?: 'ARCHIVO' | 'CUADERNO';
  revision: string | null;
  totalFilas: number;
  filasConError: number;
  pendientes: string[];
  listas?: ResumenLista[];
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
  datos: { fecha: string; platillo?: string; tiempo?: string; producto?: string; lista?: string };
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
    plantilla: (formato: 'csv' | 'xlsx', hoja?: 'listas' | 'cuaderno') =>
      http.peticion<Blob>(
        `/importaciones/plantilla?formato=${formato}${hoja ? `&hoja=${hoja}` : ''}`,
        { respuesta: 'blob' },
      ),
    cargar: (archivo: File, cuaderno?: { listas?: File }) => {
      const cuerpo = new FormData();
      cuerpo.append('archivo', archivo);
      cuerpo.append('origen', cuaderno ? 'CUADERNO' : 'ARCHIVO');
      if (cuaderno?.listas) cuerpo.append('listas', cuaderno.listas);
      return http.peticion<VistaImportacion>('/importaciones', { metodo: 'POST', cuerpo });
    },
    obtener: (id: string) => http.peticion<VistaImportacion>(`/importaciones/${id}`),
    filas: (id: string, pagina: number, soloErrores: boolean, hoja?: 'LISTAS') =>
      http.peticion<Pagina<FilaImportacion>>(
        `/importaciones/${id}/filas?pagina=${pagina}&soloErrores=${soloErrores}${hoja ? `&hoja=${hoja}` : ''}`,
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
