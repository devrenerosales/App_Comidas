import {
  despensaToca,
  etiquetaProducto,
  proximaInclusion,
  type FrecuenciaDespensa,
} from '@menu/shared';
import type { FilaDespensa } from './despensa.repositorio';

/** Producto de despensa tal como lo devuelve `GET /despensa` (api-contrato §2.7). */
export interface VistaDespensa {
  id: string;
  producto: { id: string; nombre: string; etiqueta: string };
  /** Presentaciones de compra del producto, con 3 decimales ("2.000"). */
  cantidad: string;
  frecuencia: FrecuenciaDespensa;
  /** `fecha_inicio` de la última semana en que se incluyó; null si todavía no se ha incluido. */
  ultimaInclusionSemana: string | null;
  /** Semana en que volverá a tocar; null si toca en la primera lista. */
  proximaInclusion: string | null;
  /** Toca en la lista de la próxima semana a planificar (CU-07.2 paso 3). */
  tocaEstaSemana: boolean;
  notas: string | null;
}

/** Fila del JOIN → vista de la API; `semana` es la de la próxima lista. */
export function vistaDespensa(f: FilaDespensa, semana: string): VistaDespensa {
  return {
    id: f.id,
    producto: {
      id: f.productoId,
      nombre: f.nombre,
      etiqueta: etiquetaProducto({
        nombre: f.nombre,
        unidadCompra: f.unidadCompra,
        presentacionCantidad: f.presentacionCantidad,
        presentacionUnidad: f.presentacionUnidad,
      }),
    },
    cantidad: f.cantidad,
    frecuencia: f.frecuencia,
    ultimaInclusionSemana: f.ultimaInclusionSemana,
    proximaInclusion: proximaInclusion(f.ultimaInclusionSemana, f.frecuencia),
    tocaEstaSemana: despensaToca(f.ultimaInclusionSemana, semana, f.frecuencia),
    notas: f.notas,
  };
}
