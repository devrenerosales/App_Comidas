import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SESION_CON_HOGAR, SESION_SIN_HOGAR, apiFalsa, renderizarApp } from '../test/utilidades';
import { destinoTrasSesion, useAuth } from './contexto';

describe('rutas protegidas y sesión (HU-01)', () => {
  it('sin sesión, una ruta protegida redirige a /login', async () => {
    renderizarApp('/semana');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('tras iniciar sesión vuelve a la página que intentaba abrir', async () => {
    renderizarApp('/semana');
    const usuario = userEvent.setup();
    await usuario.type(await screen.findByLabelText('Correo'), 'rene@correo.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Almuerzo2026');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(window.location.pathname).toBe('/semana'));
  });

  it('restaura la sesión al abrir la app (refresh) y muestra las pestañas', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });
    renderizarApp('/', api);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    for (const titulo of ['Inicio', 'Semana', 'Lista', 'Platillos', 'Configuración']) {
      expect(await screen.findByText(titulo, { selector: 'ion-label' })).toBeInTheDocument();
    }
  });

  it('si restaurar falla, queda como visitante', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockRejectedValue(new Error('x')) });
    renderizarApp('/inicio', api);
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('con sesión, /login lleva al inicio', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });
    renderizarApp('/login', api);
    await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
  });

  it('CU-01.1 E2: si la sesión termina durante el uso, pide volver a iniciar sesión', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });
    const { cliente } = renderizarApp('/inicio', api);
    await screen.findByText('Inicio', { selector: 'ion-label' });
    act(() => cliente.emitir(null));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('cerrar sesión desde Configuración vuelve a "Iniciar sesión"', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });
    renderizarApp('/configuracion', api);
    expect(await screen.findByText('Rene · rene@correo.com')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(api.cerrarSesion).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('cerrar sesión desde "Crear hogar"', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });
    renderizarApp('/crear-hogar', api);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('destinoTrasSesion', () => {
    expect(destinoTrasSesion(null, '/semana')).toBe('/crear-hogar');
    expect(destinoTrasSesion(SESION_CON_HOGAR.hogar)).toBe('/inicio');
    expect(destinoTrasSesion(SESION_CON_HOGAR.hogar, '/crear-hogar')).toBe('/inicio');
    expect(destinoTrasSesion(SESION_CON_HOGAR.hogar, '/lista')).toBe('/lista');
    // HU-02: tras entrar desde un enlace de invitación vuelve a él, tenga o no hogar.
    expect(destinoTrasSesion(null, '/invitacion/tok')).toBe('/invitacion/tok');
    expect(destinoTrasSesion(SESION_CON_HOGAR.hogar, '/invitacion/tok')).toBe('/invitacion/tok');
  });

  it('useAuth fuera del proveedor lanza un error claro', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Sonda() {
      useAuth();
      return null;
    }
    expect(() => render(<Sonda />)).toThrow('useAuth debe usarse dentro de <ProveedorAuth>');
    error.mockRestore();
  });
});
