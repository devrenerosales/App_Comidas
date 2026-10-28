/** Endpoints de configuración del hogar (M02 · HU-05, HU-06, HU-07, api-contrato §2.2). */
import type { ImpactoTiempo, ModoDistribucion, RepartoTiempo, TiempoComida } from '@menu/shared';
import type { ClienteHttp } from './cliente';

export interface TiempoConfigurado {
  tiempo: TiempoComida;
  activo: boolean;
  porcentaje: string;
  monto: string;
}

/** GET /hogar/configuracion. Dinero y porcentajes como texto decimal. */
export interface ConfiguracionHogar {
  version: number;
  presupuestoSemanal: string;
  tiempos: TiempoConfigurado[];
  diaInicioSemana: string;
  diaPlanificacion: string;
  horaPlanificacion: number;
  pesos: { preferencia: string; novedad: string; ahorro: string; afinidad: string };
  actualizadoEn: string;
}

export type DiaSemana =
  | 'DOMINGO'
  | 'LUNES'
  | 'MARTES'
  | 'MIERCOLES'
  | 'JUEVES'
  | 'VIERNES'
  | 'SABADO';
export interface RangoSemana {
  desde: string;
  hasta: string;
}
export interface CalendarioSemana {
  proximaSemana: RangoSemana;
  semanaTransicion: RangoSemana | null;
  proximaPlanificacion: string;
}
export interface ConfiguracionSemana extends ConfiguracionHogar, CalendarioSemana {}
export interface DatosGuardarSemana {
  version: number;
  diaInicioSemana: DiaSemana;
  diaPlanificacion: DiaSemana;
}

export interface MenuAfectado {
  id: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface RespuestaVistaPrevia {
  version: number;
  presupuestoSemanal: string;
  actual: RepartoTiempo[];
  nuevo: RepartoTiempo[];
  impacto: ImpactoTiempo[];
  aplicaDesde: string;
  menusAprobadosConservados: MenuAfectado[];
  borradoresADesactualizar: MenuAfectado[];
}

export interface ConfiguracionGuardada extends ConfiguracionHogar {
  borradoresDesactualizados: MenuAfectado[];
}

export interface TiempoPorcentaje {
  tiempo: TiempoComida;
  porcentaje: string;
}

export interface DatosVistaPrevia {
  tiempos: TiempoComida[];
  presupuestoSemanal?: string;
  distribucion?: TiempoPorcentaje[];
}

export interface DatosGuardarTiempos {
  version: number;
  tiempos: TiempoPorcentaje[];
  presupuestoSemanal?: string;
}

export interface DatosGuardarPresupuesto {
  version: number;
  presupuestoSemanal: string;
  modo?: ModoDistribucion;
  distribucion?: { tiempo: TiempoComida; porcentaje?: string; monto?: string }[];
}

const BASE = '/hogar/configuracion';

export function crearApiConfiguracion(cliente: Pick<ClienteHttp, 'peticion'>) {
  return {
    obtenerSemana: () => cliente.peticion<ConfiguracionSemana>(BASE),
    vistaPreviaSemana: (datos: DatosGuardarSemana) =>
      cliente.peticion<CalendarioSemana & { version: number }>(`${BASE}/semana/vista-previa`, {
        metodo: 'POST',
        cuerpo: datos,
      }),
    guardarSemana: (datos: DatosGuardarSemana) =>
      cliente.peticion<ConfiguracionSemana>(`${BASE}/semana`, { metodo: 'PUT', cuerpo: datos }),
    obtener: () => cliente.peticion<ConfiguracionHogar>(BASE),
    vistaPrevia: (datos: DatosVistaPrevia) =>
      cliente.peticion<RespuestaVistaPrevia>(`${BASE}/vista-previa`, {
        metodo: 'POST',
        cuerpo: datos,
      }),
    guardarTiempos: (datos: DatosGuardarTiempos) =>
      cliente.peticion<ConfiguracionGuardada>(`${BASE}/tiempos`, { metodo: 'PUT', cuerpo: datos }),
    guardarPresupuesto: (datos: DatosGuardarPresupuesto) =>
      cliente.peticion<ConfiguracionGuardada>(`${BASE}/presupuesto`, {
        metodo: 'PUT',
        cuerpo: datos,
      }),
  };
}

export type ApiConfiguracion = ReturnType<typeof crearApiConfiguracion>;
