import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, refreshToken, tokenRecuperacion, usuario, type Db } from '@menu/db';
import { DB } from '../database/database.constants';

@Injectable()
export class RecuperacionRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async crear(usuarioId: string, tokenHash: string, venceEn: Date): Promise<void> {
    await this.db.insert(tokenRecuperacion).values({ usuarioId, tokenHash, venceEn });
  }

  async vigente(tokenHash: string, ahora: Date): Promise<boolean> {
    const [fila] = await this.db
      .select({
        venceEn: tokenRecuperacion.venceEn,
        usadoEn: tokenRecuperacion.usadoEn,
        activo: usuario.activo,
      })
      .from(tokenRecuperacion)
      .innerJoin(usuario, eq(usuario.id, tokenRecuperacion.usuarioId))
      .where(eq(tokenRecuperacion.tokenHash, tokenHash));
    return Boolean(fila?.activo && !fila.usadoEn && fila.venceEn.getTime() > ahora.getTime());
  }

  /** Serializa los restablecimientos de una cuenta; todos los cambios son atómicos. */
  restablecer(tokenHash: string, hashContrasena: string, ahora: Date): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [enlace] = await tx
        .select()
        .from(tokenRecuperacion)
        .where(eq(tokenRecuperacion.tokenHash, tokenHash));
      if (!enlace) return false;
      const [cuenta] = await tx
        .select()
        .from(usuario)
        .where(eq(usuario.id, enlace.usuarioId))
        .for('update');
      if (!cuenta?.activo) return false;
      const [vigente] = await tx
        .select()
        .from(tokenRecuperacion)
        .where(eq(tokenRecuperacion.id, enlace.id))
        .for('update');
      if (!vigente || vigente.usadoEn || vigente.venceEn.getTime() <= ahora.getTime()) return false;

      await tx
        .update(usuario)
        .set({
          hashContrasena,
          intentosFallidos: 0,
          primerIntentoFallidoEn: null,
          bloqueadoHasta: null,
          sesionesInvalidasAntesDe: ahora,
        })
        .where(eq(usuario.id, cuenta.id));
      await tx
        .update(tokenRecuperacion)
        .set({ usadoEn: ahora })
        .where(and(eq(tokenRecuperacion.usuarioId, cuenta.id), isNull(tokenRecuperacion.usadoEn)));
      await tx
        .update(refreshToken)
        .set({ revocadoEn: ahora })
        .where(and(eq(refreshToken.usuarioId, cuenta.id), isNull(refreshToken.revocadoEn)));
      return true;
    });
  }
}
