import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simularAlmacenamiento } from '../test/almacenamiento';
import { SelectorTema } from './SelectorTema';

describe('SelectorTema', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-tema');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('empieza en Automático y cambia a Oscuro al elegirlo', async () => {
    simularAlmacenamiento();
    render(<SelectorTema />);
    expect(screen.getByRole('button', { name: 'Automático' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Oscuro' }));

    expect(screen.getByRole('button', { name: 'Oscuro' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.getAttribute('data-tema')).toBe('oscuro');
  });

  it('recuerda la elección guardada', () => {
    simularAlmacenamiento({ 'menu-familiar:tema': 'claro' });
    render(<SelectorTema />);
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveAttribute('aria-pressed', 'true');
  });
});
