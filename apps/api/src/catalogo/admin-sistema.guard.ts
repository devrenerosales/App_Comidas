import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { MENSAJES_CATALOGO } from '@menu/shared';
import type { RequestAutenticada } from '../auth/jwt-auth.guard';
import { Problema } from '../comun/problema';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';

/**
 * Datos globales (D-05, D-07): solo `usuario.esAdminSistema` edita, inactiva o reactiva
 * productos del catálogo común, porque el cambio afecta a todos los hogares. La marca se lee
 * de la base en cada solicitud (no viaja en el token). Crear productos queda abierto a
 * cualquier miembro (CA-12.2, CA-13.1).
 */
@Injectable()
export class AdminSistemaGuard implements CanActivate {
  constructor(private readonly usuarios: UsuariosRepositorio) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const usuarioId = contexto.switchToHttp().getRequest<RequestAutenticada>().usuario?.id;
    const usuario = usuarioId ? await this.usuarios.buscarPorId(usuarioId) : undefined;
    if (!usuario?.esAdminSistema) {
      throw new Problema(403, 'SOLO_ADMIN_SISTEMA', MENSAJES_CATALOGO.soloAdminSistema);
    }
    return true;
  }
}
