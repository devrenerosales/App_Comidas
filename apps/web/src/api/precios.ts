/** Endpoints de precios (M08 · HU-34, api-contrato §2.8). */
import type { ClienteHttp } from './cliente';
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

export function crearApiPrecios(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    registrar: (datos: DatosPrecio) =>
      cliente.peticion<PrecioRegistrado>('/precios', { metodo: 'POST', cuerpo: datos }),
  };
}

export type ApiPrecios = ReturnType<typeof crearApiPrecios>;
