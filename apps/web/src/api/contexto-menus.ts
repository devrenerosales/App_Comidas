import { createContext, useContext } from 'react';
import { crearApiMenus, type ApiMenus } from './menus';
import { cliente } from './index';

/** API del menú semanal inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiMenus = createContext<ApiMenus>(crearApiMenus(cliente));

export function useApiMenus(): ApiMenus {
  return useContext(ContextoApiMenus);
}
