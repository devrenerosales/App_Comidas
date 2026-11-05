/** Endpoints de vínculos producto ↔ supermercado (M08 · HU-35, api-contrato §2.6). */
import type { ClienteHttp } from './cliente';

export interface SupermercadoCatalogo {
  id: string;
  nombre: string;
  /** Con consulta automática: el vínculo necesita URL o SKU. */
  requiereEnlace: boolean;
  dominio: string | null;
}

export interface UltimoPrecioVinculo {
  precio: string;
  precioNormalizado: string;
  fecha: string;
  origen: 'AUTOMATICO' | 'MANUAL' | 'TICKET';
}

export interface Vinculo {
  id: string;
  productoId: string;
  supermercado: { id: string; nombre: string };
  nombreTienda: string;
  marca: string | null;
  presentacion: { cantidad: string; unidad: string; texto: string };
  factor: string;
  url: string | null;
  sku: string | null;
  activo: boolean;
  ultimoPrecio: UltimoPrecioVinculo | null;
}

export interface DatosVinculo {
  supermercadoId: string;
  nombreTienda: string;
  marca?: string;
  presentacionCantidad: string;
  presentacionUnidadId: string;
  url?: string;
  sku?: string;
}

export interface CambiosVinculo {
  nombreTienda?: string;
  marca?: string | null;
  url?: string | null;
  sku?: string | null;
}

export function crearApiVinculos(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    supermercados: () => cliente.peticion<SupermercadoCatalogo[]>('/supermercados'),
    listar: (productoId: string) =>
      cliente.peticion<Vinculo[]>(`/productos/${productoId}/vinculos`),
    /** `reemplazar` confirma el reemplazo del vínculo activo del supermercado (CA-35.3). */
    crear: (productoId: string, datos: DatosVinculo, reemplazar = false) =>
      cliente.peticion<Vinculo>(
        `/productos/${productoId}/vinculos${reemplazar ? '?reemplazar=true' : ''}`,
        { metodo: 'POST', cuerpo: datos },
      ),
    actualizar: (vinculoId: string, cambios: CambiosVinculo) =>
      cliente.peticion<Vinculo>(`/vinculos/${vinculoId}`, { metodo: 'PATCH', cuerpo: cambios }),
  };
}

export type ApiVinculos = ReturnType<typeof crearApiVinculos>;
