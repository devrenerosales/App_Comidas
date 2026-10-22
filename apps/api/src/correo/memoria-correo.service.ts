import { Logger } from '@nestjs/common';
import type { MensajeCorreo, ServicioCorreo } from './correo.tipos';

/**
 * Correo de desarrollo y pruebas (sin `SMTP_HOST`): no sale a internet. Guarda los mensajes en
 * memoria (las pruebas los leen con `enviados`) y, si `registrar` es true, escribe destinatario,
 * asunto y texto en el log para poder copiar el enlace en desarrollo.
 */
export class ServicioCorreoMemoria implements ServicioCorreo {
  private readonly logger = new Logger('Correo');
  readonly enviados: MensajeCorreo[] = [];
  /** Si es true, el siguiente `enviar` falla (simula una caída del proveedor, CU-01.2 E2). */
  fallarSiguiente = false;

  constructor(private readonly registrar = true) {}

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    if (this.fallarSiguiente) {
      this.fallarSiguiente = false;
      throw new Error('Fallo simulado del servicio de correo');
    }
    this.enviados.push(mensaje);
    if (this.registrar) {
      this.logger.log(
        `Correo (sin SMTP) para ${mensaje.para} — ${mensaje.asunto}\n${mensaje.texto}`,
      );
    }
  }

  /** Último mensaje enviado a `para` (o el último en general). */
  ultimo(para?: string): MensajeCorreo | undefined {
    const lista = para ? this.enviados.filter((m) => m.para === para) : this.enviados;
    return lista[lista.length - 1];
  }

  limpiar(): void {
    this.enviados.length = 0;
    this.fallarSiguiente = false;
  }
}
