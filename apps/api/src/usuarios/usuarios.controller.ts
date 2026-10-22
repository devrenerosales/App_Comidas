import { Controller, Get } from '@nestjs/common';
import { AuthService, type PerfilUsuario } from '../auth/auth.service';
import { UsuarioActual } from '../auth/decoradores/usuario-actual.decorator';

/** /api/v1/usuarios — perfil del usuario autenticado (RF-01). */
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly auth: AuthService) {}

  /** GET /usuarios/yo: siempre el usuario del token; no hay forma de pedir otro (RNF-06). */
  @Get('yo')
  yo(@UsuarioActual('id') usuarioId: string): Promise<PerfilUsuario> {
    return this.auth.perfil(usuarioId);
  }
}
