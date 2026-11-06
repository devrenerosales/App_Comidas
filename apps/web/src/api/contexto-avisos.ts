import { createContext, useContext } from 'react';
import { crearApiAvisos, type ApiAvisos } from './avisos';
import { cliente } from './index';

/** API de avisos inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiAvisos = createContext<ApiAvisos>(crearApiAvisos(cliente));

export function useApiAvisos(): ApiAvisos {
  return useContext(ContextoApiAvisos);
}
