/** Endpoints de restricciones y gustos del hogar (M02 · HU-10, api-contrato §2.2). */
import type { ClienteHttp } from './cliente';

export interface ElementoGusto {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface PlatilloExcluido {
  id: string;
  nombre: string;
  ingredientes: string[];
}

export interface AdvertenciaFavoritoExcluido {
  codigo: 'FAVORITO_CON_EXCLUIDO';
  platillo: { id: string; nombre: string };
  ingredientes: string[];
  mensaje: string;
}

/** GET/PUT /hogar/preferencias/gustos y su vista previa. */
export interface VistaGustos {
  ingredientesExcluidos: ElementoGusto[];
  favoritos: ElementoGusto[];
  impacto: { platillosExcluidos: PlatilloExcluido[] };
  advertencias: AdvertenciaFavoritoExcluido[];
}

export interface DatosGustos {
  ingredientesExcluidos: string[];
  favoritos: string[];
}

const BASE = '/hogar/preferencias/gustos';

export function crearApiPreferencias(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    obtener: () => cliente.peticion<VistaGustos>(BASE),
    vistaPrevia: (datos: DatosGustos) =>
      cliente.peticion<VistaGustos>(`${BASE}/vista-previa`, { metodo: 'POST', cuerpo: datos }),
    guardar: (datos: DatosGustos) =>
      cliente.peticion<VistaGustos>(BASE, { metodo: 'PUT', cuerpo: datos }),
  };
}

export type ApiPreferencias = ReturnType<typeof crearApiPreferencias>;
