/** Endpoints de la lista de compras (M07 · HU-28, api-contrato §2.7). */
import type { ClienteHttp } from './cliente';

export interface CantidadConUnidad {
  cantidad: string;
  unidad: string;
}

export interface ItemLista {
  id: string;
  producto: { id: string | null; nombre: string };
  /** Lo que piden las recetas, en la unidad de la receta; null si no se pudo sumar. */
  cantidadRequerida: CantidadConUnidad | null;
  /** Lo requerido en la unidad de compra, solo si la unidad de la receta es otra. */
  equivalente: CantidadConUnidad | null;
  /** Presentaciones enteras a comprar. */
  cantidadComprar: string;
  presentacion: { cantidad: string; unidad: string; unidadCompra: string; texto: string } | null;
  origen: 'MENU' | 'DESPENSA' | 'MENU_Y_DESPENSA' | 'MANUAL';
  estado: 'PENDIENTE' | 'COMPRADO' | 'YA_LO_TENGO';
  /** La unidad de la receta no tiene equivalencia con la de compra (CU-07.1 E1). */
  sinConversion: boolean;
  comidas: string[];
}

/** Respuesta de `GET /listas/{id}`. */
export interface ListaCompras {
  id: string;
  menuId: string;
  semana: { desde: string; hasta: string };
  version: number;
  /** Exceso con que se aprobó el menú (RN-11, D-03); null si estaba dentro del presupuesto. */
  excede: { monto: string; texto: string } | null;
  total: number;
  comprados: number;
  sinConversion: number;
  items: ItemLista[];
}

export function crearApiListas(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    obtener: (listaId: string) =>
      cliente.peticion<ListaCompras>(`/listas/${encodeURIComponent(listaId)}`),
  };
}

export type ApiListas = ReturnType<typeof crearApiListas>;
