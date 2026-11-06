/**
 * Contrato entre la corrida y la lectura de cada supermercado (ADR-007). La corrida no sabe cómo
 * se lee una página: pide a un adaptador la ruta del producto (para revisar robots.txt) y el
 * precio. Cada sitio tendrá su adaptador con selectores versionados cuando se revisen sus
 * términos de uso (PA-02, D-07); mientras no exista, el sitio no se consulta.
 */
import { validarPrecioMercado } from '@menu/shared';

/** Un vínculo activo de un supermercado que se consulta en la corrida. */
export interface VinculoConsulta {
  id: string;
  productoId: string;
  supermercadoId: string;
  nombreTienda: string;
  url: string | null;
  sku: string | null;
  /** Presentación en tienda ÷ presentación del catálogo (precio normalizado = precio ÷ factor). */
  factor: string;
}

export type TipoErrorExtraccion =
  | 'TIEMPO_AGOTADO'
  | 'HTTP'
  | 'ESTRUCTURA'
  | 'PRECIO_INVALIDO'
  | 'ROBOTS'
  | 'OTRO';

/** Falla al consultar un producto; el tipo decide cómo se registra (CU-09.3). */
export class ErrorExtraccion extends Error {
  constructor(
    readonly tipo: TipoErrorExtraccion,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorExtraccion';
  }
}

export interface AdaptadorSitio {
  /** Código del supermercado ("WALMART"). */
  readonly codigo: string;
  /** Agente que se presenta al sitio y se busca en robots.txt. */
  readonly agente: string;
  /** Dirección base del sitio ("https://www.ejemplo.com"), de donde se descarga robots.txt. */
  readonly origen: string;
  /** Ruta ("/p/123") que se consultará para el vínculo; `null` si no se puede determinar. */
  rutaProducto(vinculo: VinculoConsulta): string | null;
  /** Lee el precio de la presentación en tienda ("12.50"). Lanza `ErrorExtraccion` si falla. */
  consultar(vinculo: VinculoConsulta): Promise<string>;
}

/**
 * Valida el precio leído: debe ser un monto positivo razonable. Nunca se guarda uno inválido
 * (RF-38): devuelve el precio como texto con 2 decimales o lanza `PRECIO_INVALIDO`.
 */
export function precioLeido(texto: string): string {
  const v = validarPrecioMercado(texto);
  if (!v.ok) throw new ErrorExtraccion('PRECIO_INVALIDO', v.mensaje);
  return v.precio;
}
