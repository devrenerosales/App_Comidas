import { createContext, useContext } from 'react';
import { crearApiCatalogo, type ApiCatalogo } from './catalogo';
import { cliente } from './index';

/** API del catálogo (HU-11..13); las pruebas pasan una simulada con el proveedor. */
export const apiCatalogo = crearApiCatalogo(cliente);

export const ContextoApiCatalogo = createContext<ApiCatalogo>(apiCatalogo);

export function useApiCatalogo(): ApiCatalogo {
  return useContext(ContextoApiCatalogo);
}
