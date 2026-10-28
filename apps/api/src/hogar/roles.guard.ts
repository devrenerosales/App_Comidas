import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MENSAJES_HOGAR, Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import { ROLES_PERMITIDOS } from './decoradores/roles.decorator';
import type { RequestConHogar } from './hogar.tipos';

/** El administrador hereda los permisos del miembro (M01 §1). */
export function rolCumple(rol: Rol, permitidos: readonly Rol[]): boolean {
  return permitidos.includes(rol) || (rol === Rol.ADMIN && permitidos.includes(Rol.MIEMBRO));
}

/**
 * Autorización por rol del hogar (RN-10) con `@Roles(...)`. Va después de `HogarGuard`, que
 * deja el rol leído de la base. Sin `@Roles` la ruta queda abierta a cualquier miembro.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitidos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_PERMITIDOS, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!permitidos || permitidos.length === 0) return true;
    const rol = contexto.switchToHttp().getRequest<RequestConHogar>().hogar?.rol;
    if (!rol || !rolCumple(rol, permitidos)) {
      throw new Problema(403, 'SOLO_ADMINISTRADOR', MENSAJES_HOGAR.soloAdministrador);
    }
    return true;
  }
}
