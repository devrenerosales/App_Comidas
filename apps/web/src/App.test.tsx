import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PESTANAS } from './tabs';

function respuesta(status: number, cuerpo: unknown) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

describe('App', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin sesión (refresh 401) muestra "Iniciar sesión"', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(respuesta(401, { status: 401, codigo: 'SESION_INVALIDA', detail: 'x' }));
    vi.stubGlobal('fetch', fetch);
    window.history.replaceState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('con sesión muestra las cinco pestañas en español', async () => {
    const sesion = {
      usuario: { id: 'u1', nombre: 'Rene', correo: 'rene@correo.com', esAdminSistema: false },
      accessToken: 'a',
      expiraEn: '2026-10-22T15:15:00.000Z',
      hogar: { id: 'h1', nombre: 'Casa', rol: 'ADMIN' },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(200, sesion)));
    window.history.replaceState({}, '', '/');
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
