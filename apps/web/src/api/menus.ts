/** Endpoints del menú semanal (M05 · HU-19, M06 · HU-24 y HU-25, api-contrato §2.5, §3.1 y §3.2). */
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
  reglasAplicadas: string[];
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

/** Advertencia RN-02 o RN-03 de un cambio manual, que el usuario puede confirmar (CU-06.1 3a). */
export interface AdvertenciaPlan {
  codigo: 'RN02_PROTEINA_CONSECUTIVA' | 'RN03_PLATILLO_REPETIDO';
  fecha: string;
  tiempo: TiempoComida;
  mensaje: string;
}

/** Respuesta de `POST /menus/generar` y de las lecturas y cambios del menú. */
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
  aprobadoPor: { id: string; nombre: string } | null;
  aprobadoEn: string | null;
  /** Lista de compras de la semana; solo existe cuando el menú está aprobado. */
  listaId: string | null;
  tiempos: TiempoMenu[];
  detalles: DetalleMenu[];
  avisos: AvisoMenu[];
}

export interface DatosGenerarMenu {
  semana: string;
  regenerar?: boolean;
}

export interface DatosEditarEspacio {
  platilloId: string;
  confirmar?: boolean;
}

export interface DatosMoverEspacio {
  origenDetalleId: string;
  destinoDetalleId: string;
  confirmar?: boolean;
}

/** Respuesta de `GET /menus/{menuId}/detalles/{detalleId}/motivo` (HU-22). */
export interface MotivoSugerencia {
  detalleId: string;
  platillo: { id: string; nombre: string };
  origen: 'MOTOR' | 'REEMPLAZO_PRESUPUESTO' | 'ALTERNATIVA' | 'USUARIO' | 'HISTORICO';
  puntaje: string | null;
  factores: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  pesos: { preferencia: string; novedad: string; ahorro: string; afinidad: string } | null;
  costo: { estimado: string | null; incompleto: boolean };
  reglasAplicadas: string[];
  resumen: string;
}

/** Respuesta de `POST /menus/{id}/aprobar` (api-contrato §3.2). */
export interface RespuestaAprobacion {
  menu: MenuGenerado;
  excede: { monto: string; texto: string } | null;
  lista: { id: string; version: number; totalItems: number; url: string };
}

const id = (valor: string) => encodeURIComponent(valor);

export function crearApiMenus(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    /** El menú cuya semana contiene la fecha; 404 `SIN_MENU` si todavía no hay. */
    obtenerPorSemana: (fecha: string) =>
      cliente.peticion<MenuGenerado>(`/menus/semana/${id(fecha)}`),
    editar: (menuId: string, detalleId: string, datos: DatosEditarEspacio) =>
      cliente.peticion<MenuGenerado>(`/menus/${id(menuId)}/detalles/${id(detalleId)}`, {
        metodo: 'PATCH',
        cuerpo: datos,
      }),
    mover: (menuId: string, datos: DatosMoverEspacio) =>
      cliente.peticion<MenuGenerado>(`/menus/${id(menuId)}/mover`, {
        metodo: 'POST',
        cuerpo: datos,
      }),
    fijar: (menuId: string, detalleId: string, fijado: boolean) =>
      cliente.peticion<MenuGenerado>(`/menus/${id(menuId)}/detalles/${id(detalleId)}/fijado`, {
        metodo: 'PUT',
        cuerpo: { fijado },
      }),
    /** Por qué se sugirió el platillo de un espacio: factores, pesos usados, costo y reglas. */
    motivo: (menuId: string, detalleId: string) =>
      cliente.peticion<MotivoSugerencia>(`/menus/${id(menuId)}/detalles/${id(detalleId)}/motivo`),
    /** Aprueba el Borrador (también con exceso, D-03) y crea la lista de compras de la semana. */
    aprobar: (menuId: string, version: number) =>
      cliente.peticion<RespuestaAprobacion>(`/menus/${id(menuId)}/aprobar`, {
        metodo: 'POST',
        cuerpo: { version },
      }),
    generar: (datos: DatosGenerarMenu) =>
      cliente.peticion<MenuGenerado>('/menus/generar', { metodo: 'POST', cuerpo: datos }),
  };
}

export type ApiMenus = ReturnType<typeof crearApiMenus>;
