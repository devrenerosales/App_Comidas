/** Endpoints de avisos para el administrador (M08 · HU-38, api-contrato §2.8). */
import type { ClienteHttp } from './cliente';

export interface Aviso {
  id: string;
  tipo: 'CORRIDA_PARCIAL' | 'CORRIDA_FALLIDA' | 'SITIO_BLOQUEADO' | 'PRESUPUESTO_NO_CONFIGURADO';
  titulo: string;
  mensaje: string;
  /** Instante ISO. */
  createdAt: string;
  leido: boolean;
}

export function crearApiAvisos(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    listar: (soloNoLeidos = false) =>
      cliente.peticion<Aviso[]>(`/avisos${soloNoLeidos ? '?noLeidos=true' : ''}`),
    marcarLeido: (id: string) =>
      cliente.peticion<void>(`/avisos/${encodeURIComponent(id)}/leido`, { metodo: 'POST' }),
  };
}

export type ApiAvisos = ReturnType<typeof crearApiAvisos>;
