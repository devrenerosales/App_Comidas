import { createContext, useContext } from 'react';
import { crearApiDespensa, type ApiDespensa } from './despensa';
import { cliente } from './index';

/** API de la despensa inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiDespensa = createContext<ApiDespensa>(crearApiDespensa(cliente));

export function useApiDespensa(): ApiDespensa {
  return useContext(ContextoApiDespensa);
}
