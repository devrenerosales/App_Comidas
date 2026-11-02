/** Tipos de respuesta de restricciones y gustos (M02 · HU-10, api-contrato §2.2). */

export interface ElementoGusto {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Platillo activo que deja de sugerirse por llevar ingredientes excluidos. */
export interface PlatilloExcluido {
  id: string;
  nombre: string;
  /** Ingredientes excluidos que contiene. */
  ingredientes: string[];
}

export interface AdvertenciaFavoritoExcluido {
  codigo: 'FAVORITO_CON_EXCLUIDO';
  platillo: { id: string; nombre: string };
  ingredientes: string[];
  mensaje: string;
}

export interface VistaGustos {
  ingredientesExcluidos: ElementoGusto[];
  favoritos: ElementoGusto[];
  impacto: { platillosExcluidos: PlatilloExcluido[] };
  advertencias: AdvertenciaFavoritoExcluido[];
}
