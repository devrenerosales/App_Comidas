import { createTransport, type Transporter } from 'nodemailer';
import type { MensajeCorreo, ServicioCorreo } from './correo.tipos';

export interface ConfiguracionSmtp {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/** Límites para no dejar colgada la solicitud HTTP si el proveedor no responde (CU-01.2 E2). */
export const TIEMPOS_SMTP_MS = { conexion: 10_000, saludo: 10_000, socket: 20_000 } as const;

/** Opciones de nodemailer: 465 = TLS implícito; cualquier otro puerto exige STARTTLS (Gmail 587). */
export function opcionesTransporte(config: ConfiguracionSmtp) {
  const implicito = config.port === 465;
  return {
    host: config.host,
    port: config.port,
    secure: implicito,
    requireTLS: !implicito,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: TIEMPOS_SMTP_MS.conexion,
    greetingTimeout: TIEMPOS_SMTP_MS.saludo,
    socketTimeout: TIEMPOS_SMTP_MS.socket,
  };
}

type FabricaTransporte = (
  opciones: ReturnType<typeof opcionesTransporte>,
) => Pick<Transporter, 'sendMail'>;

/** Envío por SMTP con nodemailer (D-13: Gmail + contraseña de aplicación). */
export class ServicioCorreoSmtp implements ServicioCorreo {
  private readonly transporte: Pick<Transporter, 'sendMail'>;

  constructor(
    private readonly config: ConfiguracionSmtp,
    fabrica: FabricaTransporte = (opciones) => createTransport(opciones),
  ) {
    this.transporte = fabrica(opcionesTransporte(config));
  }

  async enviar(mensaje: MensajeCorreo): Promise<void> {
    await this.transporte.sendMail({
      from: this.config.from,
      to: mensaje.para,
      subject: mensaje.asunto,
      text: mensaje.texto,
      html: mensaje.html,
    });
  }
}
