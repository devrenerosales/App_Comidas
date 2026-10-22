import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { MENSAJES_COMENSALES, Rol } from '@menu/shared';
import { Problema } from '../comun/problema';
import type { RequestConHogar } from '../hogar/hogar.tipos';
import { rolCumple } from '../hogar/roles.guard';

/**
 * RN-10 para comensales: solo el administrador los modifica (supuesto de CU-01.3). Va después de
 * `HogarGuard`, que deja el rol leído de la base; responde con el mensaje de CA-03.4.
 */
@Injectable()
export class AdminComensalesGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const rol = contexto.switchToHttp().getRequest<RequestConHogar>().hogar?.rol;
    if (!rol || !rolCumple(rol, [Rol.ADMIN])) {
      throw new Problema(403, 'SOLO_ADMINISTRADOR', MENSAJES_COMENSALES.soloAdministrador);
    }
    return true;
  }
}
