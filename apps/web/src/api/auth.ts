/** Endpoints de cuenta (M01 · HU-01). */
import type { ClienteHttp } from './cliente';
import type { Perfil, Sesion } from './tipos';

export interface DatosRegistro {
  nombre: string;
  correo: string;
  contrasena: string;
}

export function crearApiAuth(cliente: ClienteHttp) {
  const guardar = (sesion: Sesion) => {
    cliente.establecerSesion(sesion);
    return sesion;
  };
  return {
    registrar: (datos: DatosRegistro) =>
      cliente
        .peticion<Sesion>('/auth/registro', { metodo: 'POST', cuerpo: datos, autenticar: false })
        .then(guardar),
    iniciarSesion: (correo: string, contrasena: string) =>
      cliente
        .peticion<Sesion>('/auth/login', {
          metodo: 'POST',
          cuerpo: { correo, contrasena },
          autenticar: false,
        })
        .then(guardar),
    /** Recupera la sesión al abrir la app (cookie o refresh nativo). */
    restaurar: () => cliente.renovar(),
    async cerrarSesion(): Promise<void> {
      try {
        if (cliente.tieneSesion) {
          const refreshToken = cliente.refreshToken ?? undefined;
          await cliente.peticion<void>('/auth/logout', {
            metodo: 'POST',
            cuerpo: refreshToken ? { refreshToken } : {},
          });
        }
      } catch {
        // Sin conexión o sesión ya vencida: se cierra igual en el dispositivo.
      } finally {
        cliente.limpiarSesion();
      }
    },
    perfil: () => cliente.peticion<Perfil>('/usuarios/yo'),
  };
}

export type ApiAuth = ReturnType<typeof crearApiAuth>;
