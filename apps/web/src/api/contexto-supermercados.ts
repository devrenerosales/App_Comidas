import { createContext, useContext } from 'react';
import { crearApiSupermercados, type ApiSupermercados } from './supermercados';
import { cliente } from './index';

/** API de supermercados y marcas inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiSupermercados = createContext<ApiSupermercados>(
  crearApiSupermercados(cliente),
);

export function useApiSupermercados(): ApiSupermercados {
  return useContext(ContextoApiSupermercados);
}
