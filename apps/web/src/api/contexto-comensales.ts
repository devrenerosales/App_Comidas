import { createContext, useContext } from 'react';
import { crearApiComensales, type ApiComensales } from './comensales';
import { cliente } from './index';

/** Cliente de comensales de la app (mismo cliente HTTP con sesión y refresh). */
export const apiComensales = crearApiComensales(cliente);

/** API de comensales inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiComensales = createContext<ApiComensales>(apiComensales);

export function useApiComensales(): ApiComensales {
  return useContext(ContextoApiComensales);
}
