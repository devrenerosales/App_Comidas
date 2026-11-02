/** Endpoints del menú semanal (M05 · HU-19, api-contrato §2.5 y §3.1). */
import type { ProteinaPrincipal, TiempoComida } from '@menu/shared';
import type { ClienteHttp } from './cliente';

export interface DetalleMenu {
  id: string;
  fecha: string;
  tiempo: TiempoComida;
  platillo: { id: string; nombre: string; proteinaPrincipal: ProteinaPrincipal } | null;
  fijado: boolean;
  origen: string;
  puntaje: string | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
}

export interface TiempoMenu {
  tiempo: TiempoComida;
  porcentaje: string;
  presupuesto: string;
  costoEstimado: string | null;
  exceso: string;
  estado: 'DENTRO_DEL_PRESUPUESTO' | 'EXCEDE' | 'COSTO_INCOMPLETO';
}

export interface AvisoMenu {
  codigo: string;
  fecha: string;
  tiempo: TiempoComida;
  mensaje: string;
}

/** Respuesta de `POST /menus/generar`. */
export interface MenuGenerado {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  estado: 'BORRADOR' | 'APROBADO' | 'HISTORICO';
  version: number;
  presupuestoSemanal: string | null;
  costoEstimado: string | null;
  costoIncompleto: boolean;
  excede: { monto: string; texto: string } | null;
  tiempos: TiempoMenu[];
  detalles: DetalleMenu[];
  avisos: AvisoMenu[];
}

export interface DatosGenerarMenu {
  semana: string;
  regenerar?: boolean;
}

export function crearApiMenus(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    generar: (datos: DatosGenerarMenu) =>
      cliente.peticion<MenuGenerado>('/menus/generar', { metodo: 'POST', cuerpo: datos }),
  };
}

export type ApiMenus = ReturnType<typeof crearApiMenus>;
