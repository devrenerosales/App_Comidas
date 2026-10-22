import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServicioCorreo } from './correo.tipos';
import { SERVICIO_CORREO } from './correo.tipos';
import { ServicioCorreoMemoria } from './memoria-correo.service';
import { ServicioCorreoSmtp } from './smtp-correo.service';

/** Elige la implementación según el entorno: SMTP si hay `SMTP_HOST`; si no, memoria + log. */
export function crearServicioCorreo(config: ConfigService): ServicioCorreo {
  const host = config.get<string>('SMTP_HOST')?.trim();
  const entorno = config.get<string>('NODE_ENV');
  if (!host) {
    if (entorno === 'production') {
      new Logger('Correo').warn(
        'SMTP_HOST no está definido: las invitaciones no se enviarán por correo (solo enlace).',
      );
    }
    return new ServicioCorreoMemoria(entorno !== 'test');
  }
  return new ServicioCorreoSmtp({
    host,
    port: Number(config.get('SMTP_PORT') ?? 587),
    user: config.getOrThrow<string>('SMTP_USER'),
    pass: config.getOrThrow<string>('SMTP_PASS'),
    from: config.getOrThrow<string>('SMTP_FROM'),
  });
}

/** Correo saliente (IE-03, D-13). Global: cualquier módulo inyecta `SERVICIO_CORREO`. */
@Global()
@Module({
  providers: [
    { provide: SERVICIO_CORREO, inject: [ConfigService], useFactory: crearServicioCorreo },
  ],
  exports: [SERVICIO_CORREO],
})
export class CorreoModule {}
