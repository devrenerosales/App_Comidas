import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, refreshToken, type Db } from '@menu/db';
import { DB } from '../database/database.constants';

export interface NuevoRefresh {
  usuarioId: string;
  tokenHash: string;
  familia: string;
  dispositivo: string | null;
  venceEn: Date;
}

export type ResultadoRotacion =
  | { tipo: 'invalido' }
  | { tipo: 'reutilizado'; usuarioId: string; familia: string }
  | { tipo: 'rotado'; usuarioId: string; familia: string };

/** Acceso a `refresh_token` con rotación y detección de reutilización (ADR-004). */
@Injectable()
export class RefreshTokensRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async crear(datos: NuevoRefresh): Promise<void> {
    await this.db.insert(refreshToken).values(datos);
  }

  /**
   * Rota el refresh `hashActual` por `nuevo` en una transacción con la fila bloqueada:
   * - no existe, vencido o revocado por cierre de sesión → `invalido`;
   * - ya había sido rotado (reutilización) → revoca toda la familia → `reutilizado`;
   * - vigente → marca el actual como reemplazado e inserta el nuevo → `rotado`.
   */
  rotar(
    hashActual: string,
    nuevo: Omit<NuevoRefresh, 'usuarioId' | 'familia'>,
    ahora: Date,
  ): Promise<ResultadoRotacion> {
    return this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(refreshToken)
        .where(eq(refreshToken.tokenHash, hashActual))
        .for('update');
      if (!actual) return { tipo: 'invalido' };
      if (actual.reemplazadoPorId !== null) {
        await tx
          .update(refreshToken)
          .set({ revocadoEn: ahora })
          .where(and(eq(refreshToken.familia, actual.familia), isNull(refreshToken.revocadoEn)));
        return { tipo: 'reutilizado', usuarioId: actual.usuarioId, familia: actual.familia };
      }
      if (actual.revocadoEn !== null || actual.venceEn.getTime() <= ahora.getTime()) {
        return { tipo: 'invalido' };
      }
      const [insertado] = await tx
        .insert(refreshToken)
        .values({ ...nuevo, usuarioId: actual.usuarioId, familia: actual.familia })
        .returning({ id: refreshToken.id });
      await tx
        .update(refreshToken)
        .set({ revocadoEn: ahora, reemplazadoPorId: insertado?.id })
        .where(eq(refreshToken.id, actual.id));
      return { tipo: 'rotado', usuarioId: actual.usuarioId, familia: actual.familia };
    });
  }

  /** Revoca los tokens vigentes de una familia. */
  async revocarFamilia(familia: string, ahora: Date): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revocadoEn: ahora })
      .where(and(eq(refreshToken.familia, familia), isNull(refreshToken.revocadoEn)));
  }

  /** Familia del refresh si pertenece al usuario indicado (cierre de sesión). */
  async familiaDe(hash: string, usuarioId: string): Promise<string | null> {
    const [fila] = await this.db
      .select({ familia: refreshToken.familia })
      .from(refreshToken)
      .where(and(eq(refreshToken.tokenHash, hash), eq(refreshToken.usuarioId, usuarioId)))
      .limit(1);
    return fila?.familia ?? null;
  }
}
