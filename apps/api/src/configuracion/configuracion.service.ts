import { Inject, Injectable } from '@nestjs/common';
import {
  MENSAJES_CONFIGURACION,
  ModoDistribucion,
  ORDEN_TIEMPOS,
  aCentavos,
  aCentesimas,
  calcularMontos,
  deCentavos,
  deEnteroX100,
  esCombinacionValida,
  normalizarTiempos,
  porcentajesActivos,
  porcentajesDesdeMontos,
  validarPresupuesto,
  validarSumaMontos,
  validarSumaPorcentajes,
  vistaPrevia,
  type Decimal,
  type PorTiempo,
  type TiempoComida,
} from '@menu/shared';
import type { Reloj } from '../auth/auth.constants';
import { Problema } from '../comun/problema';
import { RELOJ_CONFIGURACION } from './configuracion.constants';
import {
  ConfiguracionRepositorio,
  VersionDesactualizadaError,
  type CambiosConfiguracion,
  type ConfiguracionLeida,
  type TiempoAGuardar,
} from './configuracion.repositorio';
import type {
  RespuestaGuardado,
  RespuestaVistaPrevia,
  VistaConfiguracionHogar,
} from './configuracion.tipos';
import type {
  GuardarPresupuestoDto,
  GuardarSemanaDto,
  GuardarTiemposDto,
  TiempoPorcentajeDto,
  VistaPreviaDto,
} from './dto/configuracion.dto';
import {
  aplicaDesde,
  fechaLocal,
  calendarioSemana,
  type CalendarioSemana,
  type DiaSemana,
} from './semanas';

/** Vista de la API a partir de las filas (montos según RN-01 con la diferencia al almuerzo). */
export function vistaConfiguracionHogar({
  configuracion: c,
  tiempos,
}: ConfiguracionLeida): VistaConfiguracionHogar {
  const montos = calcularMontos(c.presupuestoSemanal, porcentajesActivos(tiempoDeFilas(tiempos)));
  return {
    version: c.version,
    presupuestoSemanal: c.presupuestoSemanal,
    tiempos: tiempoDeFilas(tiempos).map((t) => ({
      ...t,
      monto: montos[t.tiempo] ?? '0.00',
    })),
    diaInicioSemana: c.diaInicioSemana,
    diaPlanificacion: c.diaPlanificacion,
    horaPlanificacion: c.horaPlanificacion,
    pesos: {
      preferencia: c.pesoPreferencia,
      novedad: c.pesoNovedad,
      ahorro: c.pesoAhorro,
      afinidad: c.pesoAfinidad,
    },
    actualizadoEn: c.updatedAt.toISOString(),
  };
}

function tiempoDeFilas(filas: ConfiguracionLeida['tiempos']) {
  return filas.map((f) => ({
    tiempo: f.tiempo as TiempoComida,
    activo: f.activo,
    porcentaje: f.porcentaje,
  }));
}

const invalida = (codigo: string, mensaje: string, campo: string) =>
  new Problema(422, codigo, mensaje, { errores: [{ campo, mensaje }] });

/** Casos de uso CU-02.1, CU-02.2 y CU-02.3 (RF-05, RF-06, RF-07). */
@Injectable()
export class ConfiguracionService {
  constructor(
    private readonly repositorio: ConfiguracionRepositorio,
    @Inject(RELOJ_CONFIGURACION) private readonly reloj: Reloj,
  ) {}

  /** GET /hogar/configuracion (cualquier miembro). */
  async obtener(hogarId: string): Promise<VistaConfiguracionHogar & CalendarioSemana> {
    const leida = await this.leer(hogarId);
    const c = leida.configuracion;
    return {
      ...vistaConfiguracionHogar(leida),
      ...(await this.calendario(hogarId, c.diaInicioSemana, c.diaPlanificacion)),
    };
  }

  private async calendario(hogarId: string, inicio: DiaSemana, planificacion: DiaSemana) {
    const hoy = fechaLocal(this.reloj());
    const menus = await this.repositorio.menusFuturos(hogarId, hoy);
    return calendarioSemana(
      hoy,
      inicio,
      planificacion,
      menus.filter((m) => m.estado === 'APROBADO'),
    );
  }

  async vistaPreviaSemana(hogarId: string, dto: GuardarSemanaDto) {
    await this.leerVersion(hogarId, dto.version);
    return {
      version: dto.version,
      ...(await this.calendario(hogarId, dto.diaInicioSemana, dto.diaPlanificacion)),
    };
  }

  async guardarSemana(hogarId: string, usuarioId: string, dto: GuardarSemanaDto) {
    try {
      const guardada = await this.repositorio.guardarSemana(
        hogarId,
        usuarioId,
        dto.version,
        dto.diaInicioSemana,
        dto.diaPlanificacion,
        fechaLocal(this.reloj()),
      );
      return {
        ...vistaConfiguracionHogar(guardada),
        proximaSemana: guardada.proximaSemana,
        semanaTransicion: guardada.semanaTransicion,
        proximaPlanificacion: guardada.proximaPlanificacion,
      };
    } catch (error) {
      if (error instanceof VersionDesactualizadaError) throw this.versionDesactualizada();
      throw error;
    }
  }

  /**
   * POST /hogar/configuracion/vista-previa (CU-02.3 pasos 1–3): distribución propuesta (RN-06 o
   * el ajuste recibido), montos, impacto por tiempo y menús afectados. No guarda nada.
   */
  async vistaPrevia(hogarId: string, dto: VistaPreviaDto): Promise<RespuestaVistaPrevia> {
    const leida = await this.leer(hogarId);
    const tiempos = this.validarCombinacion(dto.tiempos);
    const presupuesto = this.validarPresupuesto(
      dto.presupuestoSemanal ?? leida.configuracion.presupuestoSemanal,
    );
    const ajuste = dto.distribucion ? this.porcentajesDe(dto.distribucion, tiempos) : undefined;
    if (ajuste) this.validarSuma(ajuste);
    const vista = vistaPrevia(
      {
        presupuestoSemanal: leida.configuracion.presupuestoSemanal,
        tiempos: tiempoDeFilas(leida.tiempos),
      },
      tiempos,
      presupuesto,
      ajuste,
    );
    const hoy = fechaLocal(this.reloj());
    const menus = await this.repositorio.menusFuturos(hogarId, hoy);
    const aprobados = menus.filter((m) => m.estado === 'APROBADO');
    const quitarEstado = ({ id, fechaInicio, fechaFin }: (typeof menus)[number]) => ({
      id,
      fechaInicio,
      fechaFin,
    });
    return {
      version: leida.configuracion.version,
      presupuestoSemanal: vista.presupuestoSemanal,
      actual: vista.actual,
      nuevo: vista.nuevo,
      impacto: vista.impacto,
      aplicaDesde: aplicaDesde(hoy, leida.configuracion.diaInicioSemana, aprobados),
      menusAprobadosConservados: aprobados.map(quitarEstado),
      borradoresADesactualizar: menus.filter((m) => m.estado === 'BORRADOR').map(quitarEstado),
    };
  }

  /**
   * PUT /hogar/configuracion/tiempos (CU-02.1 paso 6, CU-02.3 paso 5): tiempos activos con su
   * porcentaje (y opcionalmente el presupuesto) en una transacción con control de versión.
   */
  async guardarTiempos(
    hogarId: string,
    usuarioId: string,
    dto: GuardarTiemposDto,
  ): Promise<RespuestaGuardado> {
    const leida = await this.leerVersion(hogarId, dto.version);
    const tiempos = this.validarCombinacion(dto.tiempos.map((t) => t.tiempo));
    const porcentajes = this.porcentajesDe(dto.tiempos, tiempos);
    this.validarSuma(porcentajes);
    const presupuestoSemanal =
      dto.presupuestoSemanal === undefined
        ? undefined
        : this.validarPresupuesto(dto.presupuestoSemanal);
    return this.guardar(leida, usuarioId, {
      presupuestoSemanal,
      tiempos: filasDeTiempos(porcentajes),
    });
  }

  /**
   * PUT /hogar/configuracion/presupuesto (CU-02.2): presupuesto semanal y reparto por porcentaje
   * o por monto entre los tiempos activos. Sin distribución, conserva los porcentajes y solo
   * recalcula los montos (supuesto de M02: sin vista previa).
   */
  async guardarPresupuesto(
    hogarId: string,
    usuarioId: string,
    dto: GuardarPresupuestoDto,
  ): Promise<RespuestaGuardado> {
    const leida = await this.leerVersion(hogarId, dto.version);
    const presupuestoSemanal = this.validarPresupuesto(dto.presupuestoSemanal);
    if (!dto.distribucion) return this.guardar(leida, usuarioId, { presupuestoSemanal });

    const activos = tiempoDeFilas(leida.tiempos)
      .filter((t) => t.activo)
      .map((t) => t.tiempo);
    exigirMismosTiempos(
      dto.distribucion.map((d) => d.tiempo),
      activos,
    );
    let porcentajes: PorTiempo<string>;
    if (dto.modo === ModoDistribucion.MONTO) {
      const montos: PorTiempo<Decimal> = {};
      for (const d of dto.distribucion) {
        if (d.monto === undefined) {
          throw invalida(
            'DISTRIBUCION_INVALIDA',
            MENSAJES_CONFIGURACION.montoInvalido,
            'distribucion',
          );
        }
        montos[d.tiempo] = d.monto;
      }
      let validacion;
      try {
        validacion = validarSumaMontos(presupuestoSemanal, montos);
      } catch {
        throw invalida(
          'DISTRIBUCION_INVALIDA',
          MENSAJES_CONFIGURACION.montoInvalido,
          'distribucion',
        );
      }
      if (!validacion.valido) {
        throw invalida('MONTOS_NO_SUMAN_PRESUPUESTO', validacion.mensaje as string, 'distribucion');
      }
      porcentajes = porcentajesDesdeMontos(presupuestoSemanal, montos);
    } else {
      porcentajes = this.porcentajesDe(
        dto.distribucion.map((d) => ({ tiempo: d.tiempo, porcentaje: d.porcentaje as string })),
        activos,
      );
      this.validarSuma(porcentajes);
    }
    return this.guardar(leida, usuarioId, {
      presupuestoSemanal,
      tiempos: filasDeTiempos(porcentajes),
    });
  }

  /** Guarda solo si algo cambió; los borradores futuros se marcan "Desactualizado". */
  private async guardar(
    leida: ConfiguracionLeida,
    usuarioId: string,
    cambios: CambiosConfiguracion,
  ): Promise<RespuestaGuardado> {
    const { configuracion: c, tiempos } = leida;
    const cambiaPresupuesto =
      cambios.presupuestoSemanal !== undefined &&
      cambios.presupuestoSemanal !== c.presupuestoSemanal;
    const cambianTiempos = (cambios.tiempos ?? []).some((nuevo) => {
      const actual = tiempos.find((t) => t.tiempo === nuevo.tiempo);
      return !actual || actual.activo !== nuevo.activo || actual.porcentaje !== nuevo.porcentaje;
    });
    if (!cambiaPresupuesto && !cambianTiempos) {
      return { ...vistaConfiguracionHogar(leida), borradoresDesactualizados: [] };
    }
    try {
      const guardado = await this.repositorio.guardar(
        c.hogarId,
        c.version,
        {
          ...(cambiaPresupuesto ? { presupuestoSemanal: cambios.presupuestoSemanal } : {}),
          ...(cambianTiempos ? { tiempos: cambios.tiempos } : {}),
        },
        usuarioId,
        fechaLocal(this.reloj()),
      );
      return {
        ...vistaConfiguracionHogar(guardado),
        borradoresDesactualizados: guardado.borradoresDesactualizados,
      };
    } catch (error) {
      if (error instanceof VersionDesactualizadaError) throw this.versionDesactualizada();
      throw error;
    }
  }

  private async leer(hogarId: string): Promise<ConfiguracionLeida> {
    const leida = await this.repositorio.leer(hogarId);
    if (!leida) throw new Problema(404, 'NO_ENCONTRADO', 'El hogar no tiene configuración.');
    return leida;
  }

  /** Lee y exige que la versión del cliente sea la vigente (409, CU-02.3 E1). */
  private async leerVersion(hogarId: string, version: number): Promise<ConfiguracionLeida> {
    const leida = await this.leer(hogarId);
    if (leida.configuracion.version !== version) throw this.versionDesactualizada();
    return leida;
  }

  private versionDesactualizada(): Problema {
    return new Problema(
      409,
      'VERSION_DESACTUALIZADA',
      MENSAJES_CONFIGURACION.versionDesactualizada,
    );
  }

  /** RF-05: solo almuerzo, dos tiempos o tres tiempos (422 `COMBINACION_TIEMPOS_INVALIDA`). */
  private validarCombinacion(tiempos: readonly TiempoComida[]): TiempoComida[] {
    if (!esCombinacionValida(tiempos)) {
      throw invalida(
        'COMBINACION_TIEMPOS_INVALIDA',
        MENSAJES_CONFIGURACION.combinacionInvalida,
        'tiempos',
      );
    }
    return normalizarTiempos(tiempos);
  }

  /** CU-02.2 E1 (422 `PRESUPUESTO_INVALIDO`); devuelve el presupuesto con 2 decimales. */
  private validarPresupuesto(valor: string): string {
    const error = validarPresupuesto(valor);
    if (error) throw invalida('PRESUPUESTO_INVALIDO', error, 'presupuestoSemanal');
    return deCentavos(aCentavos(valor) as number);
  }

  /** Porcentajes de exactamente los `tiempos` indicados, con formato válido. */
  private porcentajesDe(
    lista: readonly Pick<TiempoPorcentajeDto, 'tiempo' | 'porcentaje'>[],
    tiempos: readonly TiempoComida[],
  ): PorTiempo<string> {
    exigirMismosTiempos(
      lista.map((d) => d.tiempo),
      tiempos,
    );
    const porcentajes: PorTiempo<string> = {};
    for (const d of lista) porcentajes[d.tiempo] = d.porcentaje;
    let centesimas: PorTiempo<number>;
    try {
      centesimas = aCentesimas(porcentajes);
    } catch {
      throw invalida(
        'DISTRIBUCION_INVALIDA',
        MENSAJES_CONFIGURACION.porcentajeInvalido,
        'distribucion',
      );
    }
    const normalizados: PorTiempo<string> = {};
    for (const t of tiempos) normalizados[t] = deEnteroX100(centesimas[t] as number);
    return normalizados;
  }

  /** CU-02.2 6a (422 `PORCENTAJES_NO_SUMAN_100` con "Faltan n % por asignar" o "Sobran n %"). */
  private validarSuma(porcentajes: PorTiempo<string>): void {
    const validacion = validarSumaPorcentajes(porcentajes);
    if (!validacion.valido) {
      throw invalida('PORCENTAJES_NO_SUMAN_100', validacion.mensaje as string, 'distribucion');
    }
  }
}

/** La distribución debe traer exactamente los tiempos indicados (422 `DISTRIBUCION_INVALIDA`). */
function exigirMismosTiempos(recibidos: readonly TiempoComida[], tiempos: readonly TiempoComida[]) {
  if (
    recibidos.length !== tiempos.length ||
    normalizarTiempos(recibidos).join('+') !== tiempos.join('+')
  ) {
    throw invalida(
      'DISTRIBUCION_INVALIDA',
      MENSAJES_CONFIGURACION.distribucionIncompleta,
      'distribucion',
    );
  }
}

/** Las tres filas de `tiempo_comida_config`: activas con su %, inactivas en 0. */
export function filasDeTiempos(porcentajes: PorTiempo<string>): TiempoAGuardar[] {
  return ORDEN_TIEMPOS.map((tiempo) => ({
    tiempo,
    activo: porcentajes[tiempo] !== undefined,
    porcentaje: porcentajes[tiempo] ?? '0.00',
  }));
}
