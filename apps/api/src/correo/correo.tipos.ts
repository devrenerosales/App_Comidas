/** Mensaje de correo listo para enviar: siempre con versión HTML y de texto plano. */
export interface MensajeCorreo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Puerto de salida para enviar correos (IE-03, D-13). Implementaciones:
 * - `ServicioCorreoSmtp`: nodemailer contra `SMTP_HOST` (Gmail en producción);
 * - `ServicioCorreoMemoria`: guarda los mensajes y los registra en el log (desarrollo y pruebas).
 *
 * `enviar` lanza si el proveedor rechaza o no responde; quien lo usa decide qué hacer (CU-01.2 E2).
 */
export interface ServicioCorreo {
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

/** Token de inyección: `@Inject(SERVICIO_CORREO) private readonly correo: ServicioCorreo`. */
export const SERVICIO_CORREO = Symbol('SERVICIO_CORREO');
