import { createContext, useContext } from 'react';
import { crearApiHistorial } from './historial';
import { cliente } from './index';
export const ContextoApiHistorial = createContext(crearApiHistorial(cliente));
export const useApiHistorial = () => useContext(ContextoApiHistorial);
