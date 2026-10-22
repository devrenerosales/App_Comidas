import { Capacitor } from '@capacitor/core';
import { crearApiAuth } from './auth';
import { crearApiHogar } from './hogar';
import { ClienteHttp } from './cliente';

export { ClienteHttp } from './cliente';
export { ProblemaApi, SIN_CONEXION, mensajeDeError } from './problema';
export type * from './tipos';

/** Base de la API: mismo origen en la PWA; URL absoluta en la app Android (VITE_API_URL). */
export const BASE_API = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Cliente único de la app. */
export const cliente = new ClienteHttp({
  base: BASE_API,
  nativo: Capacitor.isNativePlatform(),
  locks: typeof navigator !== 'undefined' ? navigator.locks : undefined,
});

export const apiAuth = crearApiAuth(cliente);
export const apiHogar = crearApiHogar(cliente);
