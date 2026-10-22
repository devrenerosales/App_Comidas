import { Switch } from 'react-router-dom';
import { RutaProtegida, RutaVisitante } from './auth/RutaProtegida';
import CrearCuenta from './pages/CrearCuenta';
import CrearHogar from './pages/CrearHogar';
import IniciarSesion from './pages/IniciarSesion';
import { Pestanas } from './Pestanas';

/** Rutas de la app: acceso público (login, registro) y el resto protegido. */
export function Rutas() {
  return (
    <Switch>
      <RutaVisitante exact path="/login">
        <IniciarSesion />
      </RutaVisitante>
      <RutaVisitante exact path="/registro">
        <CrearCuenta />
      </RutaVisitante>
      <RutaProtegida exact path="/crear-hogar">
        <CrearHogar />
      </RutaProtegida>
      <RutaProtegida path="/">
        <Pestanas />
      </RutaProtegida>
    </Switch>
  );
}
