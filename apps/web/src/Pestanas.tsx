import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { Redirect, Route } from 'react-router-dom';
import Configuracion from './pages/Configuracion';
import ConfiguracionTiempos from './pages/ConfiguracionTiempos';
import HogarUsuarios from './pages/HogarUsuarios';
import Inicio from './pages/Inicio';
import Lista from './pages/Lista';
import Platillos from './pages/Platillos';
import Semana from './pages/Semana';
import { PESTANAS } from './tabs';

/** Navegación principal con pestañas (solo con sesión iniciada). */
export function Pestanas() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/inicio" component={Inicio} />
        <Route exact path="/semana" component={Semana} />
        <Route exact path="/lista" component={Lista} />
        <Route exact path="/platillos" component={Platillos} />
        <Route exact path="/configuracion" component={Configuracion} />
        <Route exact path="/configuracion/hogar" component={HogarUsuarios} />
        <Route exact path="/configuracion/tiempos" component={ConfiguracionTiempos} />
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
