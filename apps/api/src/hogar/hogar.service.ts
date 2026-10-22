import { Inject, Injectable } from '@nestjs/common';
import type { Configuracion, TiempoComidaConfig } from '@menu/db';
import { MENSAJES_HOGAR, ORDEN_TIEMPOS, Rol, type TiempoComida } from '@menu/shared';
import { RELOJ, type Reloj } from '../auth/auth.constants';
import { TokensService } from '../auth/tokens.service';
import { Problema } from '../comun/problema';
import { HogarRepositorio, YaTieneHogarError } from './hogar.repositorio';
import type { RespuestaUnionHogar, VistaConfiguracion, VistaHogar } from './hogar.tipos';

/** Vista de la configuración inicial con los tiempos en orden canónico. */
export function vistaConfiguracion(
  config: Configuracion,
  tiempos: TiempoComidaConfig[],
): VistaConfiguracion {
  const orden = (t: string) => ORDEN_TIEMPOS.indexOf(t as TiempoComida);
  return {
    version: config.version,
    presupuestoSemanal: config.presupuestoSemanal,
    diaInicioSemana: config.diaInicioSemana,
    diaPlanificacion: config.diaPlanificacion,
    horaPlanificacion: config.horaPlanificacion,
    tiempos: [...tiempos]
      .sort((a, b) => orden(a.tiempo) - orden(b.tiempo))
      .map((t) => ({ tiempo: t.tiempo, activo: t.activo, porcentaje: t.porcentaje })),
  };
}

/** Casos de uso del hogar (CU-01.2 pasos 1–2, RF-02). */
@Injectable()
export class HogarService {
  constructor(
    private readonly hogares: HogarRepositorio,
    private readonly tokens: TokensService,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  /**
   * Crea el hogar con su configuración por defecto y deja al usuario como ADMIN. Devuelve un
   * token de acceso nuevo que ya lleva `hogarId` y `rol` (el anterior los traía en null).
   */
  async crear(usuarioId: string, nombre: string): Promise<RespuestaUnionHogar> {
    if (await this.hogares.membresiaDe(usuarioId)) throw this.yaTieneHogar();
    let creado;
    try {
      creado = await this.hogares.crearConConfiguracion(usuarioId, nombre);
    } catch (error) {
      if (error instanceof YaTieneHogarError) throw this.yaTieneHogar();
      throw error;
    }
    return {
      ...this.union(usuarioId, creado.hogar.id, creado.hogar.nombre, Rol.ADMIN),
      configuracion: vistaConfiguracion(creado.configuracion, creado.tiempos),
    };
  }

  /** GET /hogar: el hogar del usuario con sus miembros. */
  async obtener(hogarId: string): Promise<VistaHogar> {
    const encontrado = await this.hogares.buscar(hogarId);
    if (!encontrado) throw new Problema(404, 'NO_ENCONTRADO', 'El recurso solicitado no existe.');
    const miembros = await this.hogares.miembros(hogarId);
    return {
      id: encontrado.id,
      nombre: encontrado.nombre,
      miembros: miembros.map((m) => ({ ...m, desde: m.desde.toISOString() })),
    };
  }

  /** PATCH /hogar (ADMIN). */
  async renombrar(hogarId: string, nombre: string): Promise<{ id: string; nombre: string }> {
    const actualizado = await this.hogares.renombrar(hogarId, nombre);
    if (!actualizado) throw new Problema(404, 'NO_ENCONTRADO', 'El recurso solicitado no existe.');
    return { id: actualizado.id, nombre: actualizado.nombre };
  }

  /** Respuesta común de crear hogar y aceptar invitación, con el token de acceso renovado. */
  union(usuarioId: string, hogarId: string, nombre: string, rol: Rol): RespuestaUnionHogar {
    const acceso = this.tokens.firmarAcceso({ sub: usuarioId, hogarId, rol }, this.reloj());
    return {
      hogar: { id: hogarId, nombre, rol },
      rol,
      accessToken: acceso.token,
      expiraEn: acceso.expiraEn.toISOString(),
    };
  }

  private yaTieneHogar(): Problema {
    return new Problema(409, 'YA_TIENE_HOGAR', MENSAJES_HOGAR.yaTieneHogar);
  }
}
