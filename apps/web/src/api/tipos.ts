/** Tipos de la API v1 que usa la app (docs/02-diseno/api-contrato.md §2.1). */
import type { Rol } from '@menu/shared';

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
