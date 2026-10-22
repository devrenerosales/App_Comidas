import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { ProveedorAuth } from './auth/ProveedorAuth';
import { Rutas } from './Rutas';

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
      <ProveedorAuth>
        <IonReactRouter>
          <Rutas />
        </IonReactRouter>
      </ProveedorAuth>
    </IonApp>
  );
}
