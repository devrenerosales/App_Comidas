import type { ImpactoTiempo, RepartoTiempo, TiempoComida } from '@menu/shared';

/** Un tiempo de comida con su porcentaje guardado y el monto que resulta (RN-01). */
export interface TiempoConMonto {
  tiempo: TiempoComida;
  activo: boolean;
  porcentaje: string;
  monto: string;
}

/** GET /hogar/configuracion (api-contrato §2.2). Dinero y porcentajes como texto decimal. */
export interface VistaConfiguracionHogar {
  version: number;
  presupuestoSemanal: string;
  tiempos: TiempoConMonto[];
  diaInicioSemana: string;
  diaPlanificacion: string;
  horaPlanificacion: number;
  pesos: { preferencia: string; novedad: string; ahorro: string; afinidad: string };
  /** Instante ISO 8601 UTC de la última modificación (para mostrar "Actualizado el…"). */
  actualizadoEn: string;
}

/** Menú semanal futuro afectado (o no) por un cambio de configuración. */
export interface MenuAfectado {
  id: string;
  fechaInicio: string;
  fechaFin: string;
}

/** POST /hogar/configuracion/vista-previa (CU-02.3): nada se guarda. */
export interface RespuestaVistaPrevia {
  version: number;
  presupuestoSemanal: string;
  actual: RepartoTiempo[];
  nuevo: RepartoTiempo[];
  impacto: ImpactoTiempo[];
  /** Primer día (AAAA-MM-DD) de la primera semana que se planificará con la nueva configuración. */
  aplicaDesde: string;
  /** Menús aprobados que conservan sus tiempos, platillos y presupuesto (D-04). */
  menusAprobadosConservados: MenuAfectado[];
  /** Borradores futuros que se marcarán "Desactualizado" al confirmar (CU-02.3 5b). */
  borradoresADesactualizar: MenuAfectado[];
}

/** PUT /hogar/configuracion/tiempos y /presupuesto: configuración guardada. */
export interface RespuestaGuardado extends VistaConfiguracionHogar {
  borradoresDesactualizados: MenuAfectado[];
}
