/** Endpoints de comensales del hogar (M01 · HU-03, api-contrato §2.1). */
import type { TipoComensal } from '@menu/shared';
import type { ClienteHttp } from './cliente';

export interface Comensal {
  id: string;
  nombre: string;
  tipo: TipoComensal;
  /** Texto decimal, p. ej. `"0.50"`. */
  factorPorcion: string;
  activo: boolean;
}

export interface TotalesComensales {
  activos: number;
  adultos: number;
  ninos: number;
  /** Total de porciones = Σ factores de activos (RN-07). */
  sumaFactores: string;
}

export interface ListaComensales {
  comensales: Comensal[];
  totales: TotalesComensales;
}

export interface RespuestaComensal {
  comensal: Comensal;
  totales: TotalesComensales;
}

export interface DatosComensal {
  nombre: string;
  tipo?: TipoComensal;
  factorPorcion?: string;
}

const ruta = (id: string) => `/hogar/comensales/${encodeURIComponent(id)}`;

export function crearApiComensales(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    listar: (incluirInactivos = false) =>
      cliente.peticion<ListaComensales>(
        `/hogar/comensales${incluirInactivos ? '?incluirInactivos=true' : ''}`,
      ),
    crear: (datos: DatosComensal) =>
      cliente.peticion<RespuestaComensal>('/hogar/comensales', { metodo: 'POST', cuerpo: datos }),
    editar: (id: string, cambios: Partial<DatosComensal>) =>
      cliente.peticion<RespuestaComensal>(ruta(id), { metodo: 'PATCH', cuerpo: cambios }),
    /** Quitar = inactivar (CU-01.3 2b). */
    inactivar: (id: string) => cliente.peticion<RespuestaComensal>(ruta(id), { metodo: 'DELETE' }),
    reactivar: (id: string) =>
      cliente.peticion<RespuestaComensal>(`${ruta(id)}/reactivar`, { metodo: 'POST' }),
  };
}

export type ApiComensales = ReturnType<typeof crearApiComensales>;
