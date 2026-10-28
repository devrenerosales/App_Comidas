import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { normalizarCorreo } from '@menu/shared';
import { Problema } from '../comun/problema';
import { SERVICIO_CORREO, type ServicioCorreo } from '../correo/correo.tipos';
import { correoRecuperacion } from '../correo/plantillas/recuperacion';
import { UsuariosRepositorio } from '../usuarios/usuarios.repositorio';
import { RELOJ, type Reloj } from './auth.constants';
import { ContrasenasService } from './contrasenas.service';
import { RecuperacionRepositorio } from './recuperacion.repositorio';

export const MENSAJE_RECUPERACION = 'Si el correo existe, recibirás un enlace';
export const MENSAJE_ENLACE_INVALIDO = 'El enlace no es válido, solicita uno nuevo';
export const hashRecuperacion = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class RecuperacionService {
  private readonly logger = new Logger(RecuperacionService.name);

  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly repositorio: RecuperacionRepositorio,
    private readonly contrasenas: ContrasenasService,
    private readonly config: ConfigService,
    @Inject(SERVICIO_CORREO) private readonly correo: ServicioCorreo,
    @Inject(RELOJ) private readonly reloj: Reloj,
  ) {}

  async solicitar(correo: string): Promise<{ mensaje: string }> {
    const cuenta = await this.usuarios.buscarPorCorreo(normalizarCorreo(correo));
    if (cuenta?.activo) {
      const token = randomBytes(32).toString('base64url');
      const venceEn = new Date(this.reloj().getTime() + 60 * 60_000);
      await this.repositorio.crear(cuenta.id, hashRecuperacion(token), venceEn);
      const base = this.config.getOrThrow<string>('APP_URL').replace(/\/$/, '');
      try {
        await this.correo.enviar(
          correoRecuperacion(cuenta.correo, `${base}/restablecer/${token}`, venceEn),
        );
      } catch {
        // No revela si la cuenta existe ni registra el token o la dirección del usuario.
        this.logger.warn('No se pudo enviar un correo de recuperación.');
      }
    }
    return { mensaje: MENSAJE_RECUPERACION };
  }

  async restablecer(token: string, contrasena: string, confirmacion: string) {
    if (contrasena !== confirmacion) {
      throw new Problema(422, 'VALIDACION', 'Las contraseñas no coinciden', {
        errores: [{ campo: 'confirmacion', mensaje: 'Las contraseñas no coinciden' }],
      });
    }
    const hash = await this.contrasenas.hash(contrasena);
    if (!(await this.repositorio.restablecer(hashRecuperacion(token), hash, this.reloj()))) {
      throw new Problema(410, 'ENLACE_NO_VALIDO', MENSAJE_ENLACE_INVALIDO);
    }
    return { mensaje: 'Contraseña actualizada' };
  }

  async validar(token: string): Promise<void> {
    if (!(await this.repositorio.vigente(hashRecuperacion(token), this.reloj()))) {
      throw new Problema(410, 'ENLACE_NO_VALIDO', MENSAJE_ENLACE_INVALIDO);
    }
  }
}
