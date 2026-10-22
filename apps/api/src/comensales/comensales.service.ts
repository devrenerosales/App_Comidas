import { Injectable } from '@nestjs/common';
import type { Comensal } from '@menu/db';
import {
  FACTOR_PORCION_SUGERIDO,
  MENSAJES_COMENSALES,
  TipoComensal,
  formatearFactor,
  totalPorciones,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import {
  ComensalesRepositorio,
  NombreRepetidoError,
  UltimoComensalError,
} from './comensales.repositorio';
import type {
  CambiosComensal,
  ListaComensales,
  RespuestaComensal,
  TotalesComensales,
  VistaComensal,
} from './comensales.tipos';
import type { CrearComensalDto, EditarComensalDto } from './dto/comensal.dto';

export function vistaComensal(c: Comensal): VistaComensal {
  return {
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo as TipoComensal,
    factorPorcion: formatearFactor(c.factorPorcion),
    activo: c.activo,
  };
}

/** Totales sobre los activos; la etiqueta solo se cuenta, no pesa en la suma (D-02). */
export function totalesComensales(comensales: readonly Comensal[]): TotalesComensales {
  const activos = comensales.filter((c) => c.activo);
  return {
    activos: activos.length,
    adultos: activos.filter((c) => c.tipo === TipoComensal.ADULTO).length,
    ninos: activos.filter((c) => c.tipo === TipoComensal.NINO).length,
    sumaFactores: formatearFactor(totalPorciones(activos)),
  };
}

const noEncontrado = () => new Problema(404, 'NO_ENCONTRADO', MENSAJES_COMENSALES.noEncontrado);

/** Casos de uso de comensales del hogar (CU-01.3 · RF-03 · HU-03, D-02, RN-07). */
@Injectable()
export class ComensalesService {
  constructor(private readonly comensales: ComensalesRepositorio) {}

  /** GET /hogar/comensales: los totales siempre son de los activos. */
  async listar(hogarId: string, incluirInactivos: boolean): Promise<ListaComensales> {
    const todos = await this.comensales.listar(hogarId, true);
    const visibles = incluirInactivos ? todos : todos.filter((c) => c.activo);
    return { comensales: visibles.map(vistaComensal), totales: totalesComensales(todos) };
  }

  /**
   * Total de porciones del hogar (Σ factores de activos) para escalar cantidades (RN-07):
   * lo consumen HU-12 (ingredientes por porción) y HU-28 (lista de compras).
   */
  async totalPorciones(hogarId: string): Promise<number> {
    return totalPorciones(await this.comensales.listar(hogarId, false));
  }

  /** CU-01.3 pasos 2–5: el factor se sugiere en 1.0 y la etiqueta en ADULTO. */
  async crear(hogarId: string, dto: CrearComensalDto): Promise<RespuestaComensal> {
    const datos = {
      nombre: dto.nombre,
      tipo: dto.tipo ?? TipoComensal.ADULTO,
      factorPorcion: formatearFactor(dto.factorPorcion ?? FACTOR_PORCION_SUGERIDO),
    };
    try {
      return await this.respuesta(hogarId, await this.comensales.crear(hogarId, datos));
    } catch (error) {
      throw await this.traducir(error, hogarId, dto.nombre);
    }
  }

  /** CU-01.3 2a: cambia nombre, etiqueta o factor; la Σ factores se recalcula. */
  async editar(hogarId: string, id: string, dto: EditarComensalDto): Promise<RespuestaComensal> {
    const cambios: CambiosComensal = {};
    if (dto.nombre != null) cambios.nombre = dto.nombre;
    if (dto.tipo != null) cambios.tipo = dto.tipo;
    if (dto.factorPorcion != null) cambios.factorPorcion = formatearFactor(dto.factorPorcion);
    let actualizado: Comensal | undefined;
    try {
      actualizado = await this.comensales.actualizar(hogarId, id, cambios);
    } catch (error) {
      throw await this.traducir(error, hogarId, cambios.nombre);
    }
    if (!actualizado) throw noEncontrado();
    return this.respuesta(hogarId, actualizado);
  }

  /** CU-01.3 2b: quitar = inactivar; nunca el último activo (E2). */
  async inactivar(hogarId: string, id: string): Promise<RespuestaComensal> {
    let inactivo: Comensal | undefined;
    try {
      inactivo = await this.comensales.inactivar(hogarId, id);
    } catch (error) {
      if (error instanceof UltimoComensalError) {
        throw new Problema(422, 'ULTIMO_COMENSAL', MENSAJES_COMENSALES.ultimoComensal);
      }
      throw error;
    }
    if (!inactivo) throw noEncontrado();
    return this.respuesta(hogarId, inactivo);
  }

  /** Vuelve a contar al comensal en las porciones del hogar. */
  async reactivar(hogarId: string, id: string): Promise<RespuestaComensal> {
    const activo = await this.comensales.reactivar(hogarId, id);
    if (!activo) throw noEncontrado();
    return this.respuesta(hogarId, activo);
  }

  private async respuesta(hogarId: string, c: Comensal): Promise<RespuestaComensal> {
    const todos = await this.comensales.listar(hogarId, false);
    return { comensal: vistaComensal(c), totales: totalesComensales(todos) };
  }

  /**
   * Nombre repetido → 409 `NOMBRE_REPETIDO` (CU-01.3 E1). Si el repetido está inactivo se
   * indica su id para que la app ofrezca reactivarlo en lugar de crear otro.
   */
  private async traducir(error: unknown, hogarId: string, nombre?: string): Promise<unknown> {
    if (!(error instanceof NombreRepetidoError)) return error;
    const existente = nombre ? await this.comensales.buscarPorNombre(hogarId, nombre) : undefined;
    const extension = existente ? { comensalId: existente.id, activo: existente.activo } : {};
    return new Problema(409, 'NOMBRE_REPETIDO', MENSAJES_COMENSALES.nombreRepetido, {
      errores: [{ campo: 'nombre', mensaje: MENSAJES_COMENSALES.nombreRepetido }],
      ...extension,
    });
  }
}
