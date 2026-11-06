import { Inject, Injectable } from '@nestjs/common';
import { Problema } from '../comun/problema';
import { AvisosRepositorio } from './avisos.repositorio';
import { RELOJ_AVISOS } from './avisos.constants';

export interface VistaAviso {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  createdAt: string;
  leido: boolean;
}

/** M08 · RF-38 — avisos para el administrador del hogar (HU-38). */
@Injectable()
export class AvisosService {
  constructor(
    private readonly repo: AvisosRepositorio,
    @Inject(RELOJ_AVISOS) private readonly reloj: () => Date,
  ) {}

  async listar(hogarId: string, soloNoLeidos: boolean): Promise<VistaAviso[]> {
    const filas = await this.repo.listar(hogarId, soloNoLeidos);
    return filas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      mensaje: a.mensaje,
      createdAt: a.createdAt.toISOString(),
      leido: a.leidoEn !== null,
    }));
  }

  async marcarLeido(hogarId: string, usuarioId: string, id: string): Promise<void> {
    if (!(await this.repo.marcarLeido(hogarId, usuarioId, id, this.reloj()))) {
      throw new Problema(404, 'NO_ENCONTRADO', 'El aviso no existe.');
    }
  }
}
