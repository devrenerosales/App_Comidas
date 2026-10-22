import type { EstadoInvitacion, MedioInvitacion, Rol } from '@menu/shared';
import type { RequestAutenticada } from '../auth/jwt-auth.guard';

/** Hogar y rol del usuario autenticado, leídos de la base por `HogarGuard` (RNF-06). */
export interface HogarDelUsuario {
  hogarId: string;
  rol: Rol;
}

/** Solicitud que pasó por `HogarGuard`: trae `usuario` (JWT) y `hogar` (base de datos). */
export type RequestConHogar = RequestAutenticada & { hogar?: HogarDelUsuario };

export interface MiembroDelHogar {
  usuarioId: string;
  nombre: string;
  correo: string;
  rol: Rol;
  /** Instante ISO 8601 UTC en que se unió. */
  desde: string;
}

export interface VistaHogar {
  id: string;
  nombre: string;
  miembros: MiembroDelHogar[];
}

export interface TiempoConfigurado {
  tiempo: string;
  activo: boolean;
  porcentaje: string;
}

/** Configuración creada con el hogar (CU-01.2 paso 2, modelo-datos §8.4). */
export interface VistaConfiguracion {
  version: number;
  presupuestoSemanal: string;
  diaInicioSemana: string;
  diaPlanificacion: string;
  horaPlanificacion: number;
  tiempos: TiempoConfigurado[];
}

/** Respuesta de crear hogar y de aceptar invitación: el nuevo token ya lleva `hogarId` y `rol`. */
export interface RespuestaUnionHogar {
  hogar: { id: string; nombre: string; rol: Rol };
  rol: Rol;
  accessToken: string;
  expiraEn: string;
  configuracion?: VistaConfiguracion;
}

export interface VistaInvitacion {
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

/** Respuesta de crear una invitación: el enlace solo se puede ver aquí (se guarda su hash). */
export interface InvitacionCreada extends VistaInvitacion {
  enlace: string;
}

/** Vista pública de una invitación vigente (GET /invitaciones/{token}). */
export interface VistaPublicaInvitacion {
  hogarNombre: string;
  invitadoPor: string;
  medio: MedioInvitacion;
  /** Correo invitado enmascarado (`a**@correo.com`) o null si es por enlace. */
  correo: string | null;
  venceEn: string;
}
