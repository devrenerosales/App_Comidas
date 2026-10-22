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
}

export const ContextoAuth = createContext<ValorAuth | null>(null);

/** Sesión actual; debe usarse dentro de `<ProveedorAuth>`. */
export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth);
  if (!valor) throw new Error('useAuth debe usarse dentro de <ProveedorAuth>');
  return valor;
}

/** Ruta a la que va el usuario al entrar: sin hogar → "Crear hogar" (CU-01.1 paso 6). */
export function destinoTrasSesion(hogar: HogarDeSesion | null, desde?: string): string {
  if (!hogar) return '/crear-hogar';
  return desde && desde !== '/crear-hogar' ? desde : '/inicio';
}
