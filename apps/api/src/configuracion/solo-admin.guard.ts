import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MENSAJES_CONFIGURACION, Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { RequestConHogar } from '../hogar/hogar.tipos';

/** Metadato de `@SoloAdmin()`. */
export const MENSAJE_SOLO_ADMIN = 'menu:mensajeSoloAdmin';

/**
 * RN-10 en la configuración: solo el administrador cambia presupuesto y tiempos. Igual que
 * `@Roles(Rol.ADMIN)`, pero con el mensaje de los criterios de M02 (CA-05.4: "Solo el
 * administrador puede cambiar los tiempos de comida"). Requiere `HogarGuard` antes.
 */
export const SoloAdmin = (mensaje: string = MENSAJES_CONFIGURACION.soloAdminConfiguracion) =>
  SetMetadata(MENSAJE_SOLO_ADMIN, mensaje);

/** Corre antes del `ValidationPipe`: un miembro recibe 403 aunque el cuerpo no sea válido. */
@Injectable()
export class SoloAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const mensaje = this.reflector.getAllAndOverride<string | undefined>(MENSAJE_SOLO_ADMIN, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!mensaje) return true;
    const rol = contexto.switchToHttp().getRequest<RequestConHogar>().hogar?.rol;
    if (rol !== Rol.ADMIN) throw new Problema(403, 'SOLO_ADMINISTRADOR', mensaje);
    return true;
  }
}
