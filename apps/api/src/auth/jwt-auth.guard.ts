import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Problema } from '../comun/problema';
import { ES_PUBLICO } from './auth.constants';
import type { UsuarioAutenticado } from './auth.tipos';
import { TokensService } from './tokens.service';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';

export type RequestAutenticada = Request & { usuario?: UsuarioAutenticado };

/** Extrae el token de `Authorization: Bearer <token>`. */
export function tokenBearer(req: Pick<Request, 'headers'>): string | undefined {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  return tipo?.toLowerCase() === 'bearer' && token ? token : undefined;
}

/**
 * Guard global (APP_GUARD): toda ruta exige un JWT de acceso válido salvo las marcadas con
 * `@Publico()`. Deja el usuario en `request.usuario` para `@UsuarioActual()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly usuarios: UsuariosRepositorio,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean | undefined>(ES_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublico) return true;
    const req = contexto.switchToHttp().getRequest<RequestAutenticada>();
    const token = tokenBearer(req);
    if (!token) throw new Problema(401, 'NO_AUTENTICADO', 'Inicia sesión para continuar.');
    const claims = this.tokens.verificarAcceso(token);
    const cuenta = await this.usuarios.buscarPorId(claims.sub);
    if (
      !cuenta?.activo ||
      (cuenta.sesionesInvalidasAntesDe &&
        claims.emitidoEn <= cuenta.sesionesInvalidasAntesDe.getTime())
    ) {
      throw new Problema(401, 'SESION_REVOCADA', 'Tu sesión terminó. Inicia sesión de nuevo.');
    }
    req.usuario = { id: claims.sub, hogarId: claims.hogarId, rol: claims.rol };
    return true;
  }
}
