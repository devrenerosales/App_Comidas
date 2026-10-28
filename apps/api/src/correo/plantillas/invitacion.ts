import { DIAS_VIGENCIA_INVITACION } from '@menu/shared';
import type { MensajeCorreo } from '../correo.tipos';

export interface DatosCorreoInvitacion {
  para: string;
  hogarNombre: string;
  invitadoPor: string;
  enlace: string;
  venceEn: Date;
}

const formatoFecha = new Intl.DateTimeFormat('es-GT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Guatemala',
});

/** Fecha y hora de Guatemala en texto: "jueves, 29 de octubre de 2026, 9:00 a. m.". */
export function fechaGuatemala(fecha: Date): string {
  return formatoFecha.format(fecha);
}

const ENTIDADES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto del usuario (nombre del hogar, de quien invita) antes de ponerlo en HTML. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ENTIDADES[c] as string);
}

/** Correo de invitación a un hogar (CU-01.2 paso 5a, CA-02.1), en HTML y texto plano. */
export function correoInvitacion(datos: DatosCorreoInvitacion): MensajeCorreo {
  const vence = fechaGuatemala(datos.venceEn);
  const asunto = `${datos.invitadoPor} te invitó a ${datos.hogarNombre} en Menú Familiar`;
  const texto = [
    `¡Hola!`,
    ``,
    `${datos.invitadoPor} te invitó a unirte al hogar "${datos.hogarNombre}" en Menú Familiar,`,
    `para planificar juntos el menú de la semana y la lista de compras.`,
    ``,
    `Abre este enlace para aceptar la invitación:`,
    datos.enlace,
    ``,
    `El enlace sirve una sola vez y vence en ${DIAS_VIGENCIA_INVITACION} días (${vence}).`,
    `Si no esperabas esta invitación, puedes ignorar este correo.`,
  ].join('\n');

  const hogar = escaparHtml(datos.hogarNombre);
  const quien = escaparHtml(datos.invitadoPor);
  const enlace = escaparHtml(datos.enlace);
  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#F7F4EE;font-family:'Plus Jakarta Sans',Segoe UI,Roboto,Arial,sans-serif;color:#1E2A23;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E4DED3;border-radius:16px;">
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#2F6B4F;">Menú Familiar</p>
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">Te invitaron a ${hogar}</h1>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.5;"><strong>${quien}</strong> te invitó a unirte al hogar <strong>${hogar}</strong> para planificar juntos el menú de la semana y la lista de compras.</p>
                <p style="margin:0 0 20px;">
                  <a href="${enlace}" style="display:inline-block;padding:13px 22px;background:#2F6B4F;color:#FFFFFF;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;">Aceptar invitación</a>
                </p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5B665F;">El enlace sirve una sola vez y vence en ${DIAS_VIGENCIA_INVITACION} días (${escaparHtml(vence)}).</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#5B665F;">Si el botón no funciona, copia esta dirección en el navegador:<br><a href="${enlace}" style="color:#2F6B4F;word-break:break-all;">${enlace}</a></p>
                <p style="margin:16px 0 0;font-size:13px;color:#5B665F;">Si no esperabas esta invitación, puedes ignorar este correo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return { para: datos.para, asunto, html, texto };
}
