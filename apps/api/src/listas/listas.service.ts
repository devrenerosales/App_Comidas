import { Inject, Injectable } from '@nestjs/common';
import {
  CAMBIOS_MAXIMOS_POR_LOTE,
  avanceDeLista,
  type AvanceLista,
  type CambioLista,
} from '@menu/shared';
import { Problema } from '../comun/problema';
import { ResumenPreciosService } from '../precios/resumen-precios.service';
import type { SincronizarListaDto } from './dto/listas.dto';
import { RELOJ_LISTAS } from './listas.constants';
import { ListasRepositorio, type ResultadoSync } from './listas.repositorio';
import { vistaLista, type VistaLista } from './listas.vista';

/** Respuesta de `POST /listas/{id}/sync`: qué pasó con cada cambio y la lista vigente. */
export interface RespuestaSync {
  version: number;
  resultados: ResultadoSync[];
  lista: VistaLista;
}

const noEncontrada = () => new Problema(404, 'NO_ENCONTRADO', 'La lista no existe.');

/** M07 — lectura y edición de la lista de compras (CU-07.1 y CU-07.3, HU-28 y HU-30). */
@Injectable()
export class ListasService {
  constructor(
    private readonly repo: ListasRepositorio,
    private readonly precios: ResumenPreciosService,
    @Inject(RELOJ_LISTAS) private readonly reloj: () => Date,
  ) {}

  async obtener(hogarId: string, listaId: string): Promise<VistaLista> {
    const lista = await this.cargarAlDia(hogarId, listaId);
    if (!lista) throw noEncontrada();
    return vistaLista(lista);
  }

  /**
   * La lista con la compra sugerida al día (HU-31): antes de leerla se recalculan los resúmenes
   * de sus productos, porque un precio deja de ser vigente con el paso de los días (RN-08).
   */
  private async cargarAlDia(hogarId: string, listaId: string) {
    await this.precios.recalcularProductos(
      hogarId,
      await this.repo.productosDeLista(hogarId, listaId),
    );
    return this.repo.cargar(hogarId, listaId, this.reloj());
  }

  /** CU-07.6: avance de la compra por comida y general (RN-13). */
  async avance(hogarId: string, listaId: string): Promise<AvanceLista> {
    const lista = await this.repo.cargar(hogarId, listaId, this.reloj());
    if (!lista) throw noEncontrada();
    return avanceDeLista(
      lista.items.map((i) => ({
        id: i.id,
        producto: i.productoNombre ?? i.textoLibre ?? '',
        estado: i.estado,
        comidas: i.comidas,
      })),
      lista.comidas,
    );
  }

  /**
   * CU-07.3: aplica los cambios hechos en un dispositivo (también sin conexión). Es idempotente por
   * id de cambio y resuelve conflictos con "última escritura gana". Un cambio inválido se rechaza
   * solo (E2); el resto del lote se aplica.
   */
  async sincronizar(
    hogarId: string,
    usuarioId: string,
    listaId: string,
    dto: SincronizarListaDto,
  ): Promise<RespuestaSync> {
    if (dto.cambios.length > CAMBIOS_MAXIMOS_POR_LOTE) {
      throw new Problema(
        422,
        'LOTE_DEMASIADO_GRANDE',
        `Un lote admite hasta ${CAMBIOS_MAXIMOS_POR_LOTE} cambios.`,
      );
    }
    const aplicado = await this.repo.aplicarSync(
      hogarId,
      listaId,
      usuarioId,
      dto.cambios as CambioLista[],
    );
    if (!aplicado) throw noEncontrada();
    const lista = await this.cargarAlDia(hogarId, listaId);
    if (!lista) throw noEncontrada();
    return { version: lista.version, resultados: aplicado.resultados, lista: vistaLista(lista) };
  }
}
