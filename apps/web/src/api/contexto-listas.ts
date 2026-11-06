import { createContext, useContext } from 'react';
import { crearApiListas, type ApiListas } from './listas';
import { cliente } from './index';

/** API de la lista de compras inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiListas = createContext<ApiListas>(crearApiListas(cliente));

export function useApiListas(): ApiListas {
  return useContext(ContextoApiListas);
}
