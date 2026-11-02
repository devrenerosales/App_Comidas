import { IonApp } from '@ionic/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import Configuracion from './Configuracion';
import Inicio from './Inicio';
import Lista from './Lista';
import Platillos from './Platillos';
import Semana from './Semana';

/** Una carga que nunca termina: el test solo comprueba el título, sin estados que cambien después. */
const configuracionPendiente = {
  obtenerSemana: () => new Promise(() => undefined),
} as unknown as ApiConfiguracion;

describe.each([
  [Inicio, 'Inicio'],
  [Semana, 'Semana'],
  [Lista, 'Lista de compras'],
  [Platillos, 'Platillos'],
  [Configuracion, 'Configuración'],
])('página %#', (Pagina, titulo) => {
  it(`muestra el título "${titulo}"`, () => {
    const auth = { estado: 'autenticado', usuario: null, hogar: null } as unknown as ValorAuth;
    render(
      <IonApp>
        <ContextoAuth.Provider value={auth}>
          <ContextoApiConfiguracion.Provider value={configuracionPendiente}>
            <MemoryRouter>
              <Pagina />
            </MemoryRouter>
          </ContextoApiConfiguracion.Provider>
        </ContextoAuth.Provider>
      </IonApp>,
    );
    expect(screen.getAllByText(titulo).length).toBeGreaterThan(0);
  });
});
