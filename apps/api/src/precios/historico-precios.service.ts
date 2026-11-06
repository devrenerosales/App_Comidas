import { Inject, Injectable } from '@nestjs/common';
import {
  PERIODO_POR_DEFECTO,
  PERIODOS_SEMANAS,
  seriesDePrecios,
  type PeriodoSemanas,
  type SeriePrecios,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import { fechaLocal } from '../configuracion/semanas';
import { VinculosRepositorio } from '../vinculos/vinculos.repositorio';
import { RELOJ_PRECIOS } from './precios.constants';
import { ResumenPreciosRepositorio } from './resumen-precios.repositorio';

/** Histórico de un producto (GET /productos/{id}/precios). */
export interface VistaHistoricoPrecios {
  productoId: string;
  semanas: PeriodoSemanas;
  /** Sin ningún precio en el periodo la lista va vacía (E1). */
  series: SeriePrecios[];
}

/** M08 · CU-08.3 — histórico y variación de precios por supermercado (HU-37). */
@Injectable()
export class HistoricoPreciosService {
  constructor(
    private readonly repo: ResumenPreciosRepositorio,
    private readonly productos: VinculosRepositorio,
    @Inject(RELOJ_PRECIOS) private readonly reloj: () => Date,
  ) {}

  /** `semanas` llega como texto de la consulta; solo se admiten 12 (por defecto) o 4. */
  async obtener(
    hogarId: string,
    productoId: string,
    semanas?: string,
  ): Promise<VistaHistoricoPrecios> {
    const periodo = Number(semanas ?? PERIODO_POR_DEFECTO) as PeriodoSemanas;
    if (!PERIODOS_SEMANAS.includes(periodo)) {
      throw new Problema(400, 'PERIODO_INVALIDO', 'El periodo debe ser de 12 o de 4 semanas.');
    }
    if (!(await this.productos.producto(productoId))) {
      throw new Problema(404, 'NO_ENCONTRADO', 'El producto no existe.');
    }
    const filas = await this.repo.historico(hogarId, productoId);
    return {
      productoId,
      semanas: periodo,
      series: seriesDePrecios(
        filas.map((f) => ({ ...f })),
        fechaLocal(this.reloj()),
        periodo,
      ),
    };
  }
}
