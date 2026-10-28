import type { MensajeCorreo } from '../correo.tipos';
import { escaparHtml, fechaGuatemala } from './invitacion';

export function correoRecuperacion(para: string, enlace: string, venceEn: Date): MensajeCorreo {
  const aviso = `El enlace sirve una sola vez y vence en 1 hora (${fechaGuatemala(venceEn)}).`;
  const texto = `Solicitaste restablecer tu contraseña de Menú Familiar.\n\n${enlace}\n\n${aviso}\nSi no lo solicitaste, ignora este correo. Tu contraseña no cambiará.`;
  const url = escaparHtml(enlace);
  return {
    para,
    asunto: 'Restablece tu contraseña de Menú Familiar',
    texto,
    html: `<!doctype html><html lang="es"><body><h1>Restablecer contraseña</h1><p>Solicitaste restablecer tu contraseña de Menú Familiar.</p><p><a href="${url}">Crear nueva contraseña</a></p><p>${escaparHtml(aviso)}</p><p>Si no lo solicitaste, ignora este correo. Tu contraseña no cambiará.</p></body></html>`,
  };
}
