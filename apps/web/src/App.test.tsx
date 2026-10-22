import { render, screen } from '@testing-library/react';
import App from './App';
import { PESTANAS } from './tabs';

describe('App', () => {
  it('se renderiza sin errores', () => {
    const { baseElement } = render(<App />);
    expect(baseElement).toBeDefined();
  });

  it('muestra las cinco pestañas en español', async () => {
    render(<App />);
    for (const titulo of ['Inicio', 'Semana', 'Lista', 'Platillos', 'Configuración']) {
      expect(await screen.findByText(titulo, { selector: 'ion-label' })).toBeInTheDocument();
    }
    expect(PESTANAS.map((p) => p.ruta)).toEqual([
      '/inicio',
      '/semana',
      '/lista',
      '/platillos',
      '/configuracion',
    ]);
  });
});
