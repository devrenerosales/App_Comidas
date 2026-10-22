import { Inject, Injectable } from '@nestjs/common';
import { eq, hogar, miembroHogar, usuario, type Db, type Usuario } from '@menu/db';
import type { Rol } from '@menu/shared';
import { DB } from '../database/database.constants';
import { calcularIntentoFallido, type EstadoIntentos } from '../auth/bloqueo';
import type { HogarDeSesion } from '../auth/auth.tipos';

/** Violación de unicidad de PostgreSQL. */
const UNIQUE_VIOLATION = '23505';

export class CorreoDuplicadoError extends Error {
  constructor() {
    super('Correo duplicado');
  }
}

export interface NuevoUsuario {
  nombre: string;
  correo: string;
  hashContrasena: string;
}

/** Acceso a la tabla `usuario` (Drizzle). */
@Injectable()
export class UsuariosRepositorio {
  constructor(@Inject(DB) private readonly db: Db) {}

  async buscarPorCorreo(correo: string): Promise<Usuario | undefined> {
    const [fila] = await this.db.select().from(usuario).where(eq(usuario.correo, correo)).limit(1);
    return fila;
  }

  async buscarPorId(id: string): Promise<Usuario | undefined> {
    const [fila] = await this.db.select().from(usuario).where(eq(usuario.id, id)).limit(1);
    return fila;
  }

  /** Inserta el usuario; lanza `CorreoDuplicadoError` si el correo ya existe. */
  async crear(datos: NuevoUsuario): Promise<Usuario> {
    try {
      const [fila] = await this.db.insert(usuario).values(datos).returning();
      return fila as Usuario;
    } catch (error) {
      const codigo =
        (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code;
      if (codigo === UNIQUE_VIOLATION) throw new CorreoDuplicadoError();
      throw error;
    }
  }

  /** Suma un intento fallido de forma atómica (fila bloqueada con FOR UPDATE). */
  registrarIntentoFallido(id: string, ahora: Date): Promise<EstadoIntentos> {
    return this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select({
          intentosFallidos: usuario.intentosFallidos,
          primerIntentoFallidoEn: usuario.primerIntentoFallidoEn,
          bloqueadoHasta: usuario.bloqueadoHasta,
        })
        .from(usuario)
        .where(eq(usuario.id, id))
        .for('update');
      const nuevo = calcularIntentoFallido(
        actual ?? { intentosFallidos: 0, primerIntentoFallidoEn: null, bloqueadoHasta: null },
        ahora,
      );
      await tx.update(usuario).set(nuevo).where(eq(usuario.id, id));
      return nuevo;
    });
  }

  async reiniciarIntentos(id: string): Promise<void> {
    await this.db
      .update(usuario)
      .set({ intentosFallidos: 0, primerIntentoFallidoEn: null, bloqueadoHasta: null })
      .where(eq(usuario.id, id));
  }

  /** Hogar y rol del usuario (un hogar por usuario en v1, DM-01) o `null`. */
  async hogarDe(usuarioId: string): Promise<HogarDeSesion | null> {
    const [fila] = await this.db
      .select({ id: hogar.id, nombre: hogar.nombre, rol: miembroHogar.rol })
      .from(miembroHogar)
      .innerJoin(hogar, eq(hogar.id, miembroHogar.hogarId))
      .where(eq(miembroHogar.usuarioId, usuarioId))
      .limit(1);
    return fila ? { id: fila.id, nombre: fila.nombre, rol: fila.rol as Rol } : null;
  }
}
