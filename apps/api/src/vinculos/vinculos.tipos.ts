/** Tipos de respuesta de los vínculos producto ↔ supermercado (M08 · HU-35, api-contrato §2.6). */

export interface UltimoPrecioVinculo {
  /** Precio de la presentación en tienda. */
  precio: string;
  /** Precio llevado a la presentación de compra del catálogo (RN-08). */
  precioNormalizado: string;
  fecha: string;
  origen: 'AUTOMATICO' | 'MANUAL' | 'TICKET';
}

/** Supermercado del catálogo para elegir en el vínculo (CU-08.2 paso 1). */
export interface VistaSupermercado {
  id: string;
  nombre: string;
  /** Con consulta automática: el vínculo necesita URL o SKU (paso 2). */
  requiereEnlace: boolean;
  /** Dominio que debe tener la URL; `null` mientras no se registre (D-07). */
  dominio: string | null;
}

export interface VistaVinculo {
  id: string;
  productoId: string;
  supermercado: { id: string; nombre: string };
  nombreTienda: string;
  marca: string | null;
  /** Presentación en tienda: `{cantidad: "5", unidad: "lb", texto: "5 lb"}`. */
  presentacion: { cantidad: string; unidad: string; texto: string };
  /** Presentación en tienda ÷ presentación de compra del catálogo. */
  factor: string;
  url: string | null;
  sku: string | null;
  activo: boolean;
  ultimoPrecio: UltimoPrecioVinculo | null;
}
