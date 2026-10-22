import type { Rol } from '@menu/shared';

/** Claims del token de acceso (ADR-004). */
export interface ClaimsAcceso {
  sub: string;
  hogarId: string | null;
  rol: Rol | null;
}

/** Usuario autenticado que el guard deja en `request.usuario`. */
export interface UsuarioAutenticado {
  id: string;
  hogarId: string | null;
  rol: Rol | null;
}

export interface HogarDeSesion {
  id: string;
  nombre: string;
  rol: Rol;
}

export interface UsuarioPublico {
  id: string;
  nombre: string;
  correo: string;
  esAdminSistema: boolean;
}

/** Resultado de registro, login y refresh. */
export interface Sesion {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
  /** Instante ISO 8601 UTC en que vence el token de acceso. */
  expiraEn: string;
  hogar: HogarDeSesion | null;
}

/** Datos del cliente que inicia o renueva la sesión. */
export interface ContextoCliente {
  dispositivo?: string | null;
}
