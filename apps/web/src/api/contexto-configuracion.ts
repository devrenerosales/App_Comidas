import { createContext, useContext } from 'react';
import { crearApiConfiguracion, type ApiConfiguracion } from './configuracion';
import { cliente } from './index';

/** API de configuración inyectable (las pruebas pasan una simulada con el proveedor). */
export const ContextoApiConfiguracion = createContext<ApiConfiguracion>(
  crearApiConfiguracion(cliente),
);

export function useApiConfiguracion(): ApiConfiguracion {
  return useContext(ContextoApiConfiguracion);
}
