/**
 * Reglas de hogar e invitaciones compartidas por la API y la app (M01 · CU-01.2 · RF-02).
 * Supuestos de M01: un hogar por usuario en v1; la invitación vence a los 7 días y es de un
 * solo uso; solo el administrador invita.
 */

/** Largo máximo del nombre del hogar (columna `hogar.nombre`). */
export const LARGO_MAXIMO_NOMBRE_HOGAR = 80;

/** Vigencia de una invitación (supuesto de M01). */
export const DIAS_VIGENCIA_INVITACION = 7;

/** Medio por el que se comparte una invitación (enum `medio_invitacion`). */
export const MedioInvitacion = {
  CORREO: 'CORREO',
  ENLACE: 'ENLACE',
} as const;
export type MedioInvitacion = (typeof MedioInvitacion)[keyof typeof MedioInvitacion];

/** Estado de una invitación calculado a partir de sus marcas de uso, revocación y vencimiento. */
export const EstadoInvitacion = {
  VIGENTE: 'VIGENTE',
  USADA: 'USADA',
  REVOCADA: 'REVOCADA',
  VENCIDA: 'VENCIDA',
} as const;
export type EstadoInvitacion = (typeof EstadoInvitacion)[keyof typeof EstadoInvitacion];

export interface MarcasInvitacion {
  venceEn: Date | string;
  usadaEn: Date | string | null;
  revocadaEn: Date | string | null;
}

/** Estado de la invitación en el instante `ahora` (usada y revocada prevalecen sobre vencida). */
export function estadoInvitacion(
  invitacion: MarcasInvitacion,
  ahora: Date = new Date(),
): EstadoInvitacion {
  if (invitacion.usadaEn) return EstadoInvitacion.USADA;
  if (invitacion.revocadaEn) return EstadoInvitacion.REVOCADA;
  if (new Date(invitacion.venceEn).getTime() <= ahora.getTime()) return EstadoInvitacion.VENCIDA;
  return EstadoInvitacion.VIGENTE;
}

/** Mensajes en español de los criterios de aceptación de HU-02. */
export const MENSAJES_HOGAR = {
  /** CU-01.2 6a / CA-02.4 y crear un segundo hogar. */
  yaTieneHogar: 'Tu cuenta ya pertenece a un hogar',
  /** CU-01.2 E1 / CA-02.3: vencida, usada, revocada o inexistente. */
  invitacionNoValida: 'Invitación no válida, pide una nueva',
  /** CU-01.2 5c. */
  yaEsMiembro: 'Ya es miembro',
  /** La invitación por correo solo la acepta la cuenta de ese correo. */
  invitacionDeOtroCorreo:
    'Esta invitación se envió a otro correo. Entra con la cuenta de ese correo o pide un enlace para compartir.',
  /** RN-10. */
  soloAdministrador: 'Solo el administrador del hogar puede hacer esta acción',
  /** Ruta del hogar sin pertenecer a uno. */
  sinHogar: 'Primero crea tu hogar o únete a uno con una invitación',
  /** CU-01.2 E2. */
  correoNoEnviado: 'No pudimos enviar el correo. Copia el enlace y compártelo tú.',
  nombreObligatorio: 'Ingresa el nombre del hogar',
} as const;

/** Oculta parte del correo para mostrarlo a quien tiene el enlace: `ana@correo.com` → `a**@correo.com`. */
export function enmascararCorreo(correo: string): string {
  const [local = '', dominio = ''] = correo.split('@');
  if (!dominio) return correo;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 2))}@${dominio}`;
}
