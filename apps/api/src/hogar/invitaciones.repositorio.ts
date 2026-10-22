import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gt,
  hogar,
  invitacion,
  isNull,
  miembroHogar,
  usuario,
  type Db,
  type Invitacion,
} from '@menu/db';
import { EstadoInvitacion, estadoInvitacion, Rol, type MedioInvitacion } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import { YaTieneHogarError } from './hogar.repositorio';

export interface NuevaInvitacion {
  hogarId: string;
  creadaPorId: string;
  medio: MedioInvitacion;
  correo: string | null;
  tokenHash: string;
  /** Instante de creación: `venceEn` = `createdAt` + 7 días exactos (modelo-datos). */
  createdAt: Date;
  venceEn: Date;
}

export interface FilaInvitacion extends Invitacion {
  usadaPorNombre: string | null;
}

export interface InvitacionConHogar extends Invitacion {
  hogarNombre: string;
  creadaPorNombre: string;
}

export type ResultadoAceptar =
  | { tipo: 'no_valida' }
  | { tipo: 'ya_tiene_hogar' }
  | { tipo: 'otro_correo' }
  | { tipo: 'aceptada'; hogarId: string; hogarNombre: string };

export type ResultadoRevocar = 'revocada' | 'no_existe' | 'usada';

/** Máximo de invitaciones que lista el administrador (las más recientes). */
export const LIMITE_LISTADO_INVITACIONES = 50;

/** Acceso a `invitacion` (Drizzle). Toda consulta del administrador filtra por `hogar_id` (RNF-06). */
@Injectable()
export class InvitacionesRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async crear(datos: NuevaInvitacion): Promise<Invitacion> {
    const [fila] = await this.db.insert(invitacion).values(datos).returning();
    return fila as Invitacion;
  }

  async marcarCorreoEnviado(id: string): Promise<void> {
    await this.db.update(invitacion).set({ correoEnviado: true }).where(eq(invitacion.id, id));
  }

  /** Revoca las invitaciones vigentes al mismo correo: la nueva reemplaza a las anteriores. */
  async revocarVigentesDeCorreo(hogarId: string, correo: string, ahora: Date): Promise<void> {
    await this.db
      .update(invitacion)
      .set({ revocadaEn: ahora })
      .where(
        and(
          eq(invitacion.hogarId, hogarId),
          eq(invitacion.correo, correo),
          isNull(invitacion.usadaEn),
          isNull(invitacion.revocadaEn),
          gt(invitacion.venceEn, ahora),
        ),
      );
  }

  async listar(hogarId: string): Promise<FilaInvitacion[]> {
    const filas = await this.db
      .select({ invitacion, usadaPorNombre: usuario.nombre })
      .from(invitacion)
      .leftJoin(usuario, eq(usuario.id, invitacion.usadaPorId))
      .where(eq(invitacion.hogarId, hogarId))
      .orderBy(desc(invitacion.createdAt))
      .limit(LIMITE_LISTADO_INVITACIONES);
    return filas.map((f) => ({ ...f.invitacion, usadaPorNombre: f.usadaPorNombre }));
  }

  async buscarPorHash(tokenHash: string): Promise<InvitacionConHogar | undefined> {
    const [fila] = await this.db
      .select({ invitacion, hogarNombre: hogar.nombre, creadaPorNombre: usuario.nombre })
      .from(invitacion)
      .innerJoin(hogar, eq(hogar.id, invitacion.hogarId))
      .innerJoin(usuario, eq(usuario.id, invitacion.creadaPorId))
      .where(eq(invitacion.tokenHash, tokenHash))
      .limit(1);
    return fila
      ? { ...fila.invitacion, hogarNombre: fila.hogarNombre, creadaPorNombre: fila.creadaPorNombre }
      : undefined;
  }

  /**
   * Revoca la invitación `id` solo si es del hogar indicado. Revocar una ya revocada o vencida
   * no es error; una usada no se puede revocar.
   */
  async revocar(hogarId: string, id: string, ahora: Date): Promise<ResultadoRevocar> {
    const [actual] = await this.db
      .select()
      .from(invitacion)
      .where(and(eq(invitacion.id, id), eq(invitacion.hogarId, hogarId)))
      .limit(1);
    if (!actual) return 'no_existe';
    if (actual.usadaEn) return 'usada';
    if (!actual.revocadaEn) {
      await this.db
        .update(invitacion)
        .set({ revocadaEn: ahora })
        .where(and(eq(invitacion.id, id), isNull(invitacion.usadaEn)));
    }
    return 'revocada';
  }

  /**
   * CU-01.2 pasos 6–7 en una transacción con la invitación bloqueada (FOR UPDATE): valida que
   * esté vigente, que el usuario no tenga hogar y, si es por correo, que sea la cuenta invitada;
   * después lo une como MIEMBRO y marca la invitación como usada (un solo uso).
   */
  async aceptar(
    tokenHash: string,
    invitado: { id: string; correo: string },
    ahora: Date,
  ): Promise<ResultadoAceptar> {
    try {
      return await this.db.transaction(async (tx): Promise<ResultadoAceptar> => {
        const [actual] = await tx
          .select()
          .from(invitacion)
          .where(eq(invitacion.tokenHash, tokenHash))
          .for('update');
        if (!actual || estadoInvitacion(actual, ahora) !== EstadoInvitacion.VIGENTE) {
          return { tipo: 'no_valida' };
        }
        const [membresia] = await tx
          .select({ id: miembroHogar.id })
          .from(miembroHogar)
          .where(eq(miembroHogar.usuarioId, invitado.id))
          .limit(1);
        if (membresia) return { tipo: 'ya_tiene_hogar' };
        if (actual.correo && actual.correo !== invitado.correo) return { tipo: 'otro_correo' };
        try {
          await tx
            .insert(miembroHogar)
            .values({ hogarId: actual.hogarId, usuarioId: invitado.id, rol: Rol.MIEMBRO });
        } catch (error) {
          if (esViolacionUnicidad(error)) throw new YaTieneHogarError();
          throw error;
        }
        await tx
          .update(invitacion)
          .set({ usadaEn: ahora, usadaPorId: invitado.id })
          .where(eq(invitacion.id, actual.id));
        const [destino] = await tx
          .select({ nombre: hogar.nombre })
          .from(hogar)
          .where(eq(hogar.id, actual.hogarId));
        return { tipo: 'aceptada', hogarId: actual.hogarId, hogarNombre: destino?.nombre ?? '' };
      });
    } catch (error) {
      if (error instanceof YaTieneHogarError) return { tipo: 'ya_tiene_hogar' };
      throw error;
    }
  }
}
