import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Configuracion from './pages/Configuracion';
import Inicio from './pages/Inicio';
import Lista from './pages/Lista';
import Platillos from './pages/Platillos';
import Semana from './pages/Semana';
import { PESTANAS } from './tabs';

/* CSS base de Ionic */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';

/* Fuente y tema */
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './theme/variables.css';

setupIonicReact({ mode: 'md' });

export default function App() {
  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/inicio" component={Inicio} />
            <Route exact path="/semana" component={Semana} />
            <Route exact path="/lista" component={Lista} />
            <Route exact path="/platillos" component={Platillos} />
            <Route exact path="/configuracion" component={Configuracion} />
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
      </IonReactRouter>
    </IonApp>
  );
}
