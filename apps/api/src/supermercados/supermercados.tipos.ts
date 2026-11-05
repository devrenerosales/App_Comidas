/** Tipos de respuesta de supermercados y marcas preferidas (M02 · HU-09, api-contrato §2.2). */

export interface SupermercadoPreferido {
  supermercadoId: string;
  nombre: string;
  preferido: boolean;
}

/** Marca elegida por el hogar para un producto (CU-02.5 paso 5). */
export interface MarcaElegida {
  productoId: string;
  producto: string;
  marca: string;
}

/** Último precio conocido de una presentación vinculada; `null` si nunca se registró. */
export interface UltimoPrecioMarca {
  precio: string;
  fecha: string;
}

export interface PresentacionMarca {
  supermercado: string;
  presentacion: string;
  ultimoPrecio: UltimoPrecioMarca | null;
}

export interface OpcionMarca {
  marca: string;
  presentaciones: PresentacionMarca[];
}

/** Marcas vinculadas de un producto con su último precio (CU-02.5 pasos 3 a 5, 4a). */
export interface VistaMarcasProducto {
  productoId: string;
  producto: string;
  marcaPreferida: string | null;
  /** Vacío = "Sin marcas vinculadas" (4a). */
  marcas: OpcionMarca[];
}
