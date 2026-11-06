import { createContext, useContext } from 'react';
import { crearApiVinculos, type ApiVinculos } from './vinculos';
import { cliente } from './index';

/** API de vínculos inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiVinculos = createContext<ApiVinculos>(crearApiVinculos(cliente));

export function useApiVinculos(): ApiVinculos {
  return useContext(ContextoApiVinculos);
}
