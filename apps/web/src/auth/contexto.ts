import { createContext, useContext } from 'react';
import type { DatosRegistro } from '../api/auth';
import type { HogarDeSesion, Sesion, Usuario } from '../api/tipos';

export type EstadoSesion = 'cargando' | 'anonimo' | 'autenticado';

export interface ValorAuth {
  estado: EstadoSesion;
  usuario: Usuario | null;
  hogar: HogarDeSesion | null;
  iniciarSesion(correo: string, contrasena: string): Promise<Sesion>;
  registrar(datos: DatosRegistro): Promise<Sesion>;
  cerrarSesion(): Promise<void>;
  /** Actualiza la sesión tras crear un hogar o aceptar una invitación (HU-02). */
  entrarAlHogar(hogar: HogarDeSesion): void;
}

export const ContextoAuth = createContext<ValorAuth | null>(null);

/** Sesión actual; debe usarse dentro de `<ProveedorAuth>`. */
export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error('useAuth debe usarse dentro de <ProveedorAuth>');
  return valor;
}

/** Prefijo de la pantalla "Aceptar invitación" (HU-02). */
export const RUTA_INVITACION = '/invitacion/';

/**
 * Ruta a la que va el usuario al entrar: si venía de un enlace de invitación vuelve a él; sin
 * hogar → "Crear hogar" (CU-01.1 paso 6); con hogar → la página que intentaba abrir o Inicio.
 */
export function destinoTrasSesion(hogar: HogarDeSesion | null, desde?: string): string {
  if (desde?.startsWith(RUTA_INVITACION)) return desde;
  if (!hogar) return '/crear-hogar';
  return desde && desde !== '/crear-hogar' ? desde : '/inicio';
}
