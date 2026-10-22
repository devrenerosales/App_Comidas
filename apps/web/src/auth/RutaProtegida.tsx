import type { ReactNode } from 'react';
import { Redirect, Route, type RouteProps } from 'react-router-dom';
import { destinoTrasSesion, useAuth } from './contexto';
import { Cargando } from './Cargando';

interface Props extends Omit<RouteProps, 'render' | 'component' | 'children'> {
  children: ReactNode;
}

/** Ruta que exige sesión: sin sesión redirige a /login recordando a dónde iba. */
export function RutaProtegida({ children, ...resto }: Props) {
  const { estado } = useAuth();
  return (
    <Route
      {...resto}
      render={({ location }) => {
        if (estado === 'cargando') return <Cargando />;
        if (estado === 'anonimo') {
          return <Redirect to={{ pathname: '/login', state: { desde: location.pathname } }} />;
        }
        return children;
      }}
    />
  );
}

/**
 * Ruta solo para visitantes (login, crear cuenta). Al tener sesión lleva al destino:
 * "Crear hogar" si no tiene hogar, o la página que intentaba abrir, o Inicio.
 */
export function RutaVisitante({ children, ...resto }: Props) {
  const { estado, hogar } = useAuth();
  return (
    <Route
      {...resto}
      render={({ location }) => {
        if (estado === 'cargando') return <Cargando />;
        if (estado === 'autenticado') {
          const desde = (location.state as { desde?: string } | undefined)?.desde;
          return <Redirect to={destinoTrasSesion(hogar, desde)} />;
        }
        return children;
      }}
    />
  );
}
