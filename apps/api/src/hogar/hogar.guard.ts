import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { MENSAJES_HOGAR } from '@menu/shared';
import { Problema } from '../comun/problema';
import { HogarRepositorio } from './hogar.repositorio';
import type { RequestConHogar } from './hogar.tipos';

/**
 * Exige que el usuario autenticado pertenezca a un hogar y deja `{ hogarId, rol }` en
 * `request.hogar` (RNF-06). La pertenencia se lee de `miembro_hogar` en cada solicitud: el
 * `hogarId` del token es solo una pista y nunca se acepta un hogar desde la ruta o el cuerpo,
 * así un token emitido antes de unirse (o de cambiar de rol) no da acceso de más.
 */
@Injectable()
export class HogarGuard implements CanActivate {
  constructor(private readonly hogares: HogarRepositorio) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequestConHogar>();
    const usuarioId = req.usuario?.id;
    if (!usuarioId) throw new Problema(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');
    const membresia = await this.hogares.membresiaDe(usuarioId);
    if (!membresia) throw new Problema(403, 'SIN_HOGAR', MENSAJES_HOGAR.sinHogar);
    req.hogar = membresia;
    return true;
  }
}
