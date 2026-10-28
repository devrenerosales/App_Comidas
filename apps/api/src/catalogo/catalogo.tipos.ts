import type { MagnitudUnidad, ProteinaPrincipal, TiempoComida, TipoProducto } from '@menu/shared';

/** Unidad de medida de la semilla (§8.2). */
export interface VistaUnidad {
  id: string;
  codigo: string;
  nombre: string;
  magnitud: MagnitudUnidad;
  /** Equivalencia a g, ml o unidad; null = no convertible (manojo, diente). */
  factorBase: string | null;
}

/** Categoría fija de producto (§8.3); `orden` = pasillo en la lista de compras. */
export interface VistaCategoria {
  id: string;
  codigo: string;
  nombre: string;
  orden: number;
}

/** Producto del catálogo común (D-05) como lo devuelve la API (api-contrato §2.3). */
export interface VistaProducto {
  id: string;
  nombre: string;
  tipo: TipoProducto;
  categoria: { id: string; codigo: string; nombre: string };
  unidadCompra: string;
  presentacion: { cantidad: string; unidad: VistaUnidad };
  /** "Arroz · bolsa 2 lb" (CA-13.1). */
  etiqueta: string;
  activo: boolean;
}

export interface Paginacion {
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

/** Lista paginada (api-contrato §1.3). */
export interface Pagina<T> {
  datos: T[];
  paginacion: Paginacion;
}

export interface PlatilloAfectado {
  id: string;
  nombre: string;
}

/** Respuesta de inactivar o reactivar un producto (CU-03.3 3a). */
export interface ProductoConAfectados {
  producto: VistaProducto;
  /** Platillos del hogar de quien consulta que usan el producto (RNF-06). */
  platillosAfectados: PlatilloAfectado[];
}

/** Elemento de la lista de platillos (CU-03.1 paso 1). */
export interface ResumenPlatillo {
  id: string;
  nombre: string;
  tiempos: TiempoComida[];
  proteinaPrincipal: ProteinaPrincipal;
  etiquetas: string[];
  porcionesBase: number;
  favorito: boolean;
  /** Sin ingredientes: no tiene costo estimado (supuesto de CU-03.2). */
  incompleto: boolean;
  activo: boolean;
  calificacionPromedio: string | null;
  /** Ingredientes cuyo producto se inactivó (CA-13.2). */
  ingredientesInactivos: number;
}

export interface IngredienteDePlatillo {
  id: string;
  producto: {
    id: string;
    nombre: string;
    etiqueta: string;
    activo: boolean;
    /** Unidad de presentación: define la magnitud permitida (CU-03.2 E2). */
    presentacionUnidad: VistaUnidad;
  };
  /** Cantidad para las porciones base (decimal en texto). */
  cantidad: string;
  unidad: VistaUnidad;
}

export interface AdvertenciaPlatillo {
  codigo: 'INGREDIENTE_INACTIVO';
  mensaje: string;
  productoId: string;
}

export interface DetallePlatillo extends ResumenPlatillo {
  ingredientes: IngredienteDePlatillo[];
  advertencias: AdvertenciaPlatillo[];
}

/**
 * De dónde sale la Σ factores de la vista previa: los comensales activos del hogar (RN-07),
 * el parámetro `sumaFactores` de la consulta, o las porciones base si el hogar aún no tiene
 * comensales activos (no se escala).
 */
export type OrigenSumaFactores = 'COMENSALES' | 'PARAMETRO' | 'PORCIONES_BASE';

export interface IngredienteEscalado {
  productoId: string;
  nombre: string;
  cantidadBase: string;
  cantidadEscalada: string;
  unidad: string;
}

/** Vista previa escalada RN-07 (CU-03.2 paso 7). */
export interface VistaPrevia {
  porcionesBase: number;
  sumaFactores: string;
  origen: OrigenSumaFactores;
  ingredientes: IngredienteEscalado[];
}

/** Respuesta de PUT /platillos/{id}/ingredientes. */
export interface PlatilloConVistaPrevia extends DetallePlatillo {
  vistaPrevia: VistaPrevia;
}
