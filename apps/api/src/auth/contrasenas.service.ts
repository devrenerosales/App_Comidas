import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/** Parámetros de argon2id (ADR-004, arquitectura §9): 19 MiB, t=2, p=1. */
export const OPCIONES_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash y verificación de contraseñas con argon2id. */
@Injectable()
export class ContrasenasService {
  private hashFicticio?: Promise<string>;

  hash(contrasena: string): Promise<string> {
    return argon2.hash(contrasena, OPCIONES_ARGON2);
  }

  /** `true` si coincide; un hash corrupto se trata como contraseña incorrecta. */
  async verificar(hash: string, contrasena: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, contrasena);
    } catch {
      return false;
    }
  }

  /**
   * Hace el mismo trabajo que una verificación real cuando el correo no existe, para que el
   * tiempo de respuesta no revele si hay una cuenta (siempre devuelve `false`).
   */
  async verificarFicticio(contrasena: string): Promise<false> {
    this.hashFicticio ??= this.hash('menu-familiar-hash-ficticio-0');
    await this.verificar(await this.hashFicticio, contrasena);
    return false;
  }
}
