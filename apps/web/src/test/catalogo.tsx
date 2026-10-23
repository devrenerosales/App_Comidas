import { IonApp } from '@ionic/react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import type { ApiCatalogo } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import PlatilloDetalle from '../pages/PlatilloDetalle';
import Platillos from '../pages/Platillos';
import Productos from '../pages/Productos';
import { apiCatalogoFalsa } from './catalogo-datos';

/** Renderiza las pantallas del catálogo en `ruta` con la API simulada. */
export function renderizarCatalogo(
  ruta: string,
  api = apiCatalogoFalsa(),
  usuario: Partial<NonNullable<ValorAuth['usuario']>> = {},
) {
  const auth = {
    estado: 'autenticado',
    usuario: {
      id: 'u1',
      nombre: 'Ana',
      correo: 'ana@correo.com',
      esAdminSistema: false,
      ...usuario,
    },
    hogar: { id: 'h1', nombre: 'Familia Rosales', rol: 'MIEMBRO' },
  } as unknown as ValorAuth;
  const resultado = render(
    <IonApp>
      <ContextoAuth.Provider value={auth}>
        <ContextoApiCatalogo.Provider value={api as unknown as ApiCatalogo}>
          <MemoryRouter initialEntries={[ruta]}>
            <Switch>
              <Route exact path="/platillos" component={Platillos} />
              <Route exact path="/platillos/nuevo" component={PlatilloDetalle} />
              <Route exact path="/platillos/productos" component={Productos} />
              <Route exact path="/platillos/:id" component={PlatilloDetalle} />
            </Switch>
          </MemoryRouter>
        </ContextoApiCatalogo.Provider>
      </ContextoAuth.Provider>
    </IonApp>,
  );
  return { ...resultado, api };
}
