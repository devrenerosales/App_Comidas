import { Injectable } from '@nestjs/common';
import { CAMBIOS_MAXIMOS_POR_LOTE, type CambioLista } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { SincronizarListaDto } from './dto/listas.dto';
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
  constructor(private readonly repo: ListasRepositorio) {}

  async obtener(hogarId: string, listaId: string): Promise<VistaLista> {
    const lista = await this.repo.cargar(hogarId, listaId);
    if (!lista) throw noEncontrada();
    return vistaLista(lista);
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
    const lista = await this.repo.cargar(hogarId, listaId);
    if (!lista) throw noEncontrada();
    return { version: lista.version, resultados: aplicado.resultados, lista: vistaLista(lista) };
  }
}
