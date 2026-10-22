import { IonApp } from '@ionic/react';
import { render, screen } from '@testing-library/react';
import Configuracion from './Configuracion';
import Inicio from './Inicio';
import Lista from './Lista';
import Platillos from './Platillos';
import Semana from './Semana';

describe.each([
  [Inicio, 'Inicio'],
  [Semana, 'Semana'],
  [Lista, 'Lista de compras'],
  [Platillos, 'Platillos'],
  [Configuracion, 'Configuración'],
])('página %#', (Pagina, titulo) => {
  it(`muestra el título "${titulo}"`, () => {
    render(
      <IonApp>
        <Pagina />
      </IonApp>,
    );
    expect(screen.getAllByText(titulo).length).toBeGreaterThan(0);
  });
});
