import { Route, Switch } from 'react-router-dom';
import { RutaProtegida, RutaVisitante } from './auth/RutaProtegida';
import AceptarInvitacion from './pages/AceptarInvitacion';
import CrearCuenta from './pages/CrearCuenta';
import CrearHogar from './pages/CrearHogar';
import IniciarSesion from './pages/IniciarSesion';
import { Pestanas } from './Pestanas';

/**
 * Rutas de la app: acceso público (login, registro), "Aceptar invitación" (con o sin sesión),
 * "Crear hogar" (con sesión y sin hogar) y el resto (con sesión y hogar).
 */
export function Rutas() {
  return (
    <Switch>
      <RutaVisitante exact path="/login">
        <IniciarSesion />
      </RutaVisitante>
      <RutaVisitante exact path="/registro">
        <CrearCuenta />
      </RutaVisitante>
      <Route exact path="/invitacion/:token">
        <AceptarInvitacion />
      </Route>
      <RutaProtegida exact path="/crear-hogar" hogar="prohibido">
        <CrearHogar />
      </RutaProtegida>
      <RutaProtegida path="/" hogar="requerido">
        <Pestanas />
      </RutaProtegida>
    </Switch>
  );
}
