import { createContext, useContext } from 'react';
import { crearApiPrecios, type ApiPrecios } from './precios';
import { cliente } from './index';

/** API de precios inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiPrecios = createContext<ApiPrecios>(crearApiPrecios(cliente));

export function useApiPrecios(): ApiPrecios {
  return useContext(ContextoApiPrecios);
}
