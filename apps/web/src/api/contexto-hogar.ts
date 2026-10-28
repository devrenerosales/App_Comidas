import { createContext, useContext } from 'react';
import type { ApiHogar } from './hogar';
import { apiHogar } from './index';

/** API del hogar inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiHogar = createContext<ApiHogar>(apiHogar);

export function useApiHogar(): ApiHogar {
  return useContext(ContextoApiHogar);
}
