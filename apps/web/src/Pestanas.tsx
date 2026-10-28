import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { Redirect, Route } from 'react-router-dom';
import Comensales from './pages/Comensales';
import Configuracion from './pages/Configuracion';
import ConfiguracionTiempos from './pages/ConfiguracionTiempos';
import ConfiguracionSemana from './pages/ConfiguracionSemana';
import HogarUsuarios from './pages/HogarUsuarios';
import Inicio from './pages/Inicio';
import Historial from './pages/Historial';
import CapturarSemana from './pages/CapturarSemana';
import ImportarHistorial from './pages/ImportarHistorial';
import Lista from './pages/Lista';
import PlatilloDetalle from './pages/PlatilloDetalle';
import Platillos from './pages/Platillos';
import Productos from './pages/Productos';
import Semana from './pages/Semana';
import { PESTANAS } from './tabs';

/** Navegación principal con pestañas (solo con sesión iniciada). */
export function Pestanas() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/inicio" component={Inicio} />
        <Route exact path="/historial" component={Historial} />
        <Route exact path="/historial/capturar" component={CapturarSemana} />
        <Route exact path="/historial/importar" component={ImportarHistorial} />
        <Route exact path="/historial/importar/:id([0-9a-f-]{36})" component={ImportarHistorial} />
        <Route exact path="/semana" component={Semana} />
        <Route exact path="/lista" component={Lista} />
        <Route exact path="/platillos" component={Platillos} />
        <Route exact path="/platillos/nuevo" component={PlatilloDetalle} />
        <Route exact path="/platillos/productos" component={Productos} />
        <Route exact path="/platillos/:id([0-9a-f-]{36})" component={PlatilloDetalle} />
        <Route exact path="/configuracion" component={Configuracion} />
        <Route exact path="/configuracion/hogar" component={HogarUsuarios} />
        <Route exact path="/configuracion/comensales" component={Comensales} />
        <Route exact path="/configuracion/tiempos" component={ConfiguracionTiempos} />
        <Route exact path="/configuracion/semana" component={ConfiguracionSemana} />
        <Route exact path="/">
          <Redirect to="/inicio" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        {PESTANAS.map((p) => (
          <IonTabButton key={p.ruta} tab={p.ruta.slice(1)} href={p.ruta}>
            <IonIcon aria-hidden="true" icon={p.icono} />
            <IonLabel>{p.titulo}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}
