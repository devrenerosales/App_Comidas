import { createContext, useContext } from 'react';
import { crearApiTablero, type ApiTablero } from './tablero';
import { cliente } from './index';

/** API del tablero inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiTablero = createContext<ApiTablero>(crearApiTablero(cliente));

export function useApiTablero(): ApiTablero {
  return useContext(ContextoApiTablero);
}
