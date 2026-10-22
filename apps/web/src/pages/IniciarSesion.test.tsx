import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import { SESION_SIN_HOGAR, apiFalsa, renderizarApp } from '../test/utilidades';

async function entrar(correo: string, contrasena: string) {
  const usuario = userEvent.setup();
  await screen.findByRole('heading', { name: 'Iniciar sesión' });
  if (correo) await usuario.type(screen.getByLabelText('Correo'), correo);
  if (contrasena) await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
  return usuario;
}

describe('Iniciar sesión (HU-01)', () => {
  it('CA-01.1 con hogar: entra y muestra el inicio del hogar', async () => {
    const { api } = renderizarApp('/login');
    await entrar('rene@correo.com', 'Almuerzo2026');
    expect(api.iniciarSesion).toHaveBeenCalledWith('rene@correo.com', 'Almuerzo2026');
    await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
    expect(await screen.findByText('Inicio', { selector: 'ion-label' })).toBeInTheDocument();
  });

  it('CA-01.1 sin hogar: la app lo lleva a "Crear hogar"', async () => {
    const api = apiFalsa({ iniciarSesion: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });
    renderizarApp('/login', api);
    await entrar('rene@correo.com', 'Almuerzo2026');
    await waitFor(() => expect(window.location.pathname).toBe('/crear-hogar'));
  });

  it('CA-01.3 credenciales inválidas: "Correo o contraseña incorrectos"', async () => {
    const api = apiFalsa({
      iniciarSesion: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 401,
          codigo: 'CREDENCIALES_INVALIDAS',
          detail: 'Correo o contraseña incorrectos',
        }),
      ),
    });
    renderizarApp('/login', api);
    await entrar('rene@correo.com', 'incorrecta1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(window.location.pathname).toBe('/login');
  });

  it('CA-01.3 cuenta bloqueada: explica la espera de 15 minutos y la hora', async () => {
    const api = apiFalsa({
      iniciarSesion: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 423,
          codigo: 'CUENTA_BLOQUEADA',
          detail:
            'Por seguridad, el inicio de sesión de esta cuenta está bloqueado 15 minutos. Intenta más tarde.',
          bloqueadoHasta: '2026-10-22T15:15:00.000Z',
        }),
      ),
    });
    renderizarApp('/login', api);
    await entrar('rene@correo.com', 'Almuerzo2026');
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('bloqueado 15 minutos');
    // 15:15 UTC = 9:15 en Guatemala (UTC-6).
    expect(alerta).toHaveTextContent(/9:15/);
  });

  it('CA-01.3 bloqueo sin hora: muestra solo el mensaje de la API', async () => {
    const api = apiFalsa({
      iniciarSesion: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 423, codigo: 'CUENTA_BLOQUEADA', detail: 'Bloqueada.' }),
        ),
    });
    renderizarApp('/login', api);
    await entrar('rene@correo.com', 'Almuerzo2026');
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Bloqueada\.$/);
  });

  it('exige correo y contraseña', async () => {
    const { api } = renderizarApp('/login');
    await entrar('', '');
    expect(screen.getByText('Ingresa tu correo')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(api.iniciarSesion).not.toHaveBeenCalled();
  });

  it('enlaza a "Crear cuenta"', async () => {
    renderizarApp('/login');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
  });
});
