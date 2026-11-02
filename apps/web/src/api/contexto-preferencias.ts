import { createContext, useContext } from 'react';
import { crearApiPreferencias, type ApiPreferencias } from './preferencias';
import { cliente } from './index';

/** API de restricciones y gustos inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiPreferencias = createContext<ApiPreferencias>(
  crearApiPreferencias(cliente),
);

export function useApiPreferencias(): ApiPreferencias {
  return useContext(ContextoApiPreferencias);
}
