/** Endpoints de supermercados y marcas preferidas (M02 · HU-09, api-contrato §2.2). */
import type { ClienteHttp } from './cliente';

export interface SupermercadoPreferido {
  supermercadoId: string;
  nombre: string;
  preferido: boolean;
}

export interface MarcaElegida {
  productoId: string;
  producto: string;
  marca: string;
}

export interface PresentacionMarca {
  supermercado: string;
  presentacion: string;
  ultimoPrecio: { precio: string; fecha: string } | null;
}

export interface OpcionMarca {
  marca: string;
  presentaciones: PresentacionMarca[];
}

/** GET/PUT /hogar/preferencias/marcas/{productoId}. */
export interface VistaMarcasProducto {
  productoId: string;
  producto: string;
  marcaPreferida: string | null;
  marcas: OpcionMarca[];
}

const BASE = '/hogar/preferencias';

export function crearApiSupermercados(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    supermercados: () => cliente.peticion<SupermercadoPreferido[]>(`${BASE}/supermercados`),
    guardarSupermercados: (preferidos: string[]) =>
      cliente.peticion<SupermercadoPreferido[]>(`${BASE}/supermercados`, {
        metodo: 'PUT',
        cuerpo: { preferidos },
      }),
    marcasElegidas: () => cliente.peticion<MarcaElegida[]>(`${BASE}/marcas`),
    marcasDeProducto: (productoId: string) =>
      cliente.peticion<VistaMarcasProducto>(`${BASE}/marcas/${productoId}`),
    guardarMarca: (productoId: string, marca: string | null) =>
      cliente.peticion<VistaMarcasProducto>(`${BASE}/marcas/${productoId}`, {
        metodo: 'PUT',
        cuerpo: { marca },
      }),
  };
}

export type ApiSupermercados = ReturnType<typeof crearApiSupermercados>;
