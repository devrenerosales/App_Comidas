import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  configuracion,
  eq,
  hogar,
  miembroHogar,
  tiempoComidaConfig,
  usuario,
  type Configuracion,
  type Db,
  type Hogar,
  type TiempoComidaConfig,
} from '@menu/db';
import { Rol } from '@menu/shared';
import { esViolacionUnicidad } from '../comun/postgres';
import { DB } from '../database/database.constants';
import { CONFIGURACION_POR_DEFECTO, tiemposPorDefecto } from './configuracion-por-defecto';
import type { HogarDelUsuario } from './hogar.tipos';

/** El usuario ya pertenece a un hogar (índice único `miembro_hogar.usuario_id`, DM-01). */
export class YaTieneHogarError extends Error {
  constructor() {
    super('El usuario ya pertenece a un hogar');
  }
}

export interface HogarCreado {
  hogar: Hogar;
  configuracion: Configuracion;
  tiempos: TiempoComidaConfig[];
}

export interface FilaMiembro {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: Rol;
  desde: Date;
}

/** Acceso a `hogar`, `miembro_hogar` y la configuración inicial (Drizzle). */
@Injectable()
export class HogarRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * CU-01.2 paso 2 en una sola transacción: hogar, miembro ADMIN, configuración por defecto y
   * sus tres tiempos de comida. Lanza `YaTieneHogarError` si el usuario ya tiene hogar.
   */
  crearConConfiguracion(usuarioId: string, nombre: string): Promise<HogarCreado> {
    return this.db.transaction(async (tx) => {
      const [nuevo] = await tx.insert(hogar).values({ nombre }).returning();
      const creado = nuevo as Hogar;
      try {
        await tx.insert(miembroHogar).values({ hogarId: creado.id, usuarioId, rol: Rol.ADMIN });
      } catch (error) {
        if (esViolacionUnicidad(error)) throw new YaTieneHogarError();
        throw error;
      }
      const [config] = await tx
        .insert(configuracion)
        .values({ hogarId: creado.id, ...CONFIGURACION_POR_DEFECTO, actualizadoPorId: usuarioId })
        .returning();
      const conf = config as Configuracion;
      const tiempos = await tx
        .insert(tiempoComidaConfig)
        .values(tiemposPorDefecto().map((t) => ({ ...t, configuracionId: conf.id })))
        .returning();
      return { hogar: creado, configuracion: conf, tiempos };
    });
  }

  /** Hogar y rol del usuario (un hogar por usuario en v1) o `null`. */
  async membresiaDe(usuarioId: string): Promise<HogarDelUsuario | null> {
    const [fila] = await this.db
      .select({ hogarId: miembroHogar.hogarId, rol: miembroHogar.rol })
      .from(miembroHogar)
      .where(eq(miembroHogar.usuarioId, usuarioId))
      .limit(1);
    return fila ? { hogarId: fila.hogarId, rol: fila.rol as Rol } : null;
  }

  async buscar(hogarId: string): Promise<Hogar | undefined> {
    const [fila] = await this.db.select().from(hogar).where(eq(hogar.id, hogarId)).limit(1);
    return fila;
  }

  /** Miembros del hogar: primero el administrador, luego por fecha de unión. */
  async miembros(hogarId: string): Promise<FilaMiembro[]> {
    const filas = await this.db
      .select({
        usuarioId: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: miembroHogar.rol,
        desde: miembroHogar.createdAt,
      })
      .from(miembroHogar)
      .innerJoin(usuario, eq(usuario.id, miembroHogar.usuarioId))
      .where(eq(miembroHogar.hogarId, hogarId))
      .orderBy(asc(miembroHogar.rol), asc(miembroHogar.createdAt));
    return filas.map((f) => ({ ...f, rol: f.rol as Rol }));
  }

  /** `true` si algún miembro del hogar tiene ese correo (CU-01.2 5c). */
  async tieneMiembroConCorreo(hogarId: string, correo: string): Promise<boolean> {
    const [fila] = await this.db
      .select({ id: miembroHogar.id })
      .from(miembroHogar)
      .innerJoin(usuario, eq(usuario.id, miembroHogar.usuarioId))
      .where(and(eq(miembroHogar.hogarId, hogarId), eq(usuario.correo, correo)))
      .limit(1);
    return Boolean(fila);
  }

  async renombrar(hogarId: string, nombre: string): Promise<Hogar | undefined> {
    const [fila] = await this.db
      .update(hogar)
      .set({ nombre })
      .where(eq(hogar.id, hogarId))
      .returning();
    return fila;
  }
}
