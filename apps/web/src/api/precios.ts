/** Endpoints de precios (M08 · HU-34, api-contrato §2.8). */
import type { PeriodoSemanas, SeriePrecios } from '@menu/shared';
import type { ClienteHttp } from './cliente';
import { ProblemaApi } from './problema';
import type { Vinculo } from './vinculos';

/**
 * Precio manual: sobre un vínculo (`productoSupermercadoId`) o sobre el par producto +
 * supermercado; sin vínculo activo, la presentación crea uno mínimo (flujo alterno 1a).
 */
export interface DatosPrecio {
  productoSupermercadoId?: string;
  productoId?: string;
  supermercadoId?: string;
  presentacionCantidad?: string;
  presentacionUnidadId?: string;
  precio: string;
  fechaPrecio: string;
}

export interface PrecioRegistrado {
  id: string;
  precio: string;
  precioNormalizado: string;
  fechaPrecio: string;
  origen: 'MANUAL';
  vinculo: Vinculo;
  vinculoCreado: boolean;
}

/** GET /productos/{id}/resumen-precio (HU-36): mediana para el costo y mínimo para la compra. */
export interface ResumenPrecio {
  productoId: string;
  precioMediana: string;
  precioMinimo: string;
  supermercadoMinimo: { id: string; nombre: string };
  fechaPrecioMinimo: string;
  cantidadPrecios: number;
  /** Ningún precio de los últimos 14 días: se usaron los últimos conocidos. */
  desactualizado: boolean;
  fechaPrecioMasAntiguo: string;
  calculadoEn: string;
}

/** GET /productos/{id}/precios (HU-37): series por supermercado con sus variaciones. */
export interface HistoricoPrecios {
  productoId: string;
  semanas: PeriodoSemanas;
  /** Vacía si el producto no tiene precios en el periodo. */
  series: SeriePrecios[];
}

export function crearApiPrecios(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    /** `null` si el producto no tiene ningún precio ("Sin precio", E1). */
    resumen: async (productoId: string): Promise<ResumenPrecio | null> => {
      try {
        return await cliente.peticion<ResumenPrecio>(`/productos/${productoId}/resumen-precio`);
      } catch (e) {
        if (e instanceof ProblemaApi && e.codigo === 'SIN_PRECIO') return null;
        throw e;
      }
    },
    historico: (productoId: string, semanas: PeriodoSemanas = 12) =>
      cliente.peticion<HistoricoPrecios>(`/productos/${productoId}/precios?semanas=${semanas}`),
    registrar: (datos: DatosPrecio) =>
      cliente.peticion<PrecioRegistrado>('/precios', { metodo: 'POST', cuerpo: datos }),
  };
}

export type ApiPrecios = ReturnType<typeof crearApiPrecios>;
