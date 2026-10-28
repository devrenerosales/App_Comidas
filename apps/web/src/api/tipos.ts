/** Tipos de la API v1 que usa la app (docs/02-diseno/api-contrato.md §2.1). */
import type { EstadoInvitacion, MedioInvitacion, Rol } from '@menu/shared';

export interface Usuario {
  id: string;
  nombre: string;
  correo: string;
  esAdminSistema: boolean;
}

export interface HogarDeSesion {
  id: string;
  nombre: string;
  rol: Rol;
}

/** Respuesta de registro, login y refresh. En la PWA `refreshToken` no viene (cookie). */
export interface Sesion {
  usuario: Usuario;
  accessToken: string;
  refreshToken?: string;
  expiraEn: string;
  hogar: HogarDeSesion | null;
}

export interface Perfil extends Usuario {
  hogar: HogarDeSesion | null;
}

/** Error de un campo (RFC 7807 extendido). */
export interface ErrorCampo {
  campo: string;
  mensaje: string;
}

/** Respuesta de crear hogar y de aceptar invitación (HU-02): trae un token de acceso nuevo. */
export interface RespuestaUnionHogar {
  hogar: HogarDeSesion;
  rol: Rol;
  accessToken: string;
  expiraEn: string;
}

export interface MiembroHogar {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: Rol;
  desde: string;
}

export interface VistaHogar {
  id: string;
  nombre: string;
  miembros: MiembroHogar[];
}

export interface Invitacion {
  id: string;
  medio: MedioInvitacion;
  correo: string | null;
  estado: EstadoInvitacion;
  venceEn: string;
  creadaEn: string;
  correoEnviado: boolean;
  usadaEn: string | null;
  usadaPor: string | null;
}

/** El enlace solo viene al crear la invitación (la API guarda únicamente su hash). */
export interface InvitacionCreada extends Invitacion {
  enlace: string;
}

/** GET /invitaciones/{token}: lo que ve quien abre el enlace. */
export interface InvitacionPublica {
  hogarNombre: string;
  invitadoPor: string;
  medio: MedioInvitacion;
  correo: string | null;
  venceEn: string;
}
