import { Inject, Injectable } from '@nestjs/common';
import { and, aviso, desc, eq, isNull, type Db } from '@menu/db';
import { DB } from '../database/database.constants';

export interface FilaAviso {
  id: string;
  tipo: 'CORRIDA_PARCIAL' | 'CORRIDA_FALLIDA' | 'SITIO_BLOQUEADO' | 'PRESUPUESTO_NO_CONFIGURADO';
  titulo: string;
  mensaje: string;
  createdAt: Date;
  leidoEn: Date | null;
}

/** Avisos dentro de la app de un hogar (CU-09.1 3a, CU-09.3 paso 5, RF-38). */
@Injectable()
export class AvisosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Los más recientes primero; con `soloNoLeidos` solo los que nadie ha marcado como leídos. */
  async listar(hogarId: string, soloNoLeidos: boolean): Promise<FilaAviso[]> {
    return this.db
      .select({
        id: aviso.id,
        tipo: aviso.tipo,
        titulo: aviso.titulo,
        mensaje: aviso.mensaje,
        createdAt: aviso.createdAt,
        leidoEn: aviso.leidoEn,
      })
      .from(aviso)
      .where(and(eq(aviso.hogarId, hogarId), soloNoLeidos ? isNull(aviso.leidoEn) : undefined))
      .orderBy(desc(aviso.createdAt));
  }

  /** `false` si el aviso no existe o es de otro hogar (RNF-06); marcar uno leído otra vez no cambia nada. */
  async marcarLeido(hogarId: string, usuarioId: string, id: string, ahora: Date): Promise<boolean> {
    const [existente] = await this.db
      .select({ id: aviso.id, leidoEn: aviso.leidoEn })
      .from(aviso)
      .where(and(eq(aviso.id, id), eq(aviso.hogarId, hogarId)));
    if (!existente) return false;
    if (existente.leidoEn === null) {
      await this.db
        .update(aviso)
        .set({ leidoEn: ahora, leidoPorId: usuarioId })
        .where(eq(aviso.id, id));
    }
    return true;
  }
}
