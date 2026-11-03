import { Injectable } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { ListasRepositorio } from './listas.repositorio';
import { vistaLista, type VistaLista } from './listas.vista';

/** M07 — lectura de la lista de compras de un menú aprobado (CU-07.1, HU-28). */
@Injectable()
export class ListasService {
  constructor(private readonly repo: ListasRepositorio) {}

  async obtener(hogarId: string, listaId: string): Promise<VistaLista> {
    const lista = await this.repo.cargar(hogarId, listaId);
    if (!lista) throw new Problema(404, 'NO_ENCONTRADO', 'La lista no existe.');
    return vistaLista(lista);
  }
}
