/** Endpoints de la lista de compras (M07 · HU-28 y HU-30, api-contrato §2.7). */
import type { CambioLista, ComidaDelMenu } from '@menu/shared';
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
  /** Total pagado y lo anotado al comprar (CU-07.7); null o ausente si no se registró precio. */
  precioReal?: string | null;
  contenidoComprado?: string | null;
  precioNormalizado?: string | null;
  /** RN-12: promedio de compra del hogar en las últimas 12 semanas. */
  promedioCompra?: { precio: string; compras: number } | null;
  /** Mediana de mercado del producto, como referencia junto al promedio. */
  medianaMercado?: string | null;
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
  /** Comidas del menú; con `items[].comidas` dan el avance por comida (HU-43). Puede faltar en copias antiguas. */
  comidas?: ComidaDelMenu[];
  /** Suma de los precios reales de lo comprado, sugerida como gasto real de la semana (CU-07.7). */
  gastoSugerido?: string;
}

/** Qué pasó con un cambio del lote (api-contrato §2.7). */
export interface ResultadoSync {
  id: string;
  resultado: 'APLICADO' | 'OBSOLETO' | 'RECHAZADO';
  motivo?: string;
}

/** Respuesta de `POST /listas/{id}/sync`: resultados por cambio y la lista vigente. */
export interface RespuestaSync {
  version: number;
  resultados: ResultadoSync[];
  lista: ListaCompras;
}

export function crearApiListas(cliente: Pick<ClienteHttp, 'peticion'>) {
  const id = (valor: string) => encodeURIComponent(valor);
  return {
    obtener: (listaId: string) => cliente.peticion<ListaCompras>(`/listas/${id(listaId)}`),
    /** Envía los cambios hechos en el dispositivo; es idempotente por id de cambio (CU-07.3). */
    sincronizar: (listaId: string, cambios: CambioLista[], versionBase?: number) =>
      cliente.peticion<RespuestaSync>(`/listas/${id(listaId)}/sync`, {
        metodo: 'POST',
        cuerpo: { ...(versionBase !== undefined ? { versionBase } : {}), cambios },
      }),
  };
}

export type ApiListas = ReturnType<typeof crearApiListas>;
