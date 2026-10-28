import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import {
  SESION_CON_HOGAR,
  SESION_SIN_HOGAR,
  apiFalsa,
  apiHogarFalsa,
  clienteFalso,
  renderizarApp,
} from '../test/utilidades';

const RUTA = '/invitacion/tok-enlace';
const vencida = () =>
  new ProblemaApi({
    status: 410,
    codigo: 'INVITACION_NO_VALIDA',
    detail: 'Invitación no válida, pide una nueva',
  });

describe('Aceptar invitación (HU-02)', () => {
  it('CA-02.2 sin sesión: abre el enlace, inicia sesión, vuelve y queda como Miembro', async () => {
    const api = apiFalsa({ iniciarSesion: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });
    const { apiHogar } = renderizarApp(RUTA, api);
    expect(
      await screen.findByRole('heading', { name: 'Únete a Familia Rosales' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rene te invitó/)).toBeInTheDocument();
    expect(screen.getByText(/vence el jueves, 29 de octubre/)).toBeInTheDocument();
    expect(apiHogar.verInvitacion).toHaveBeenCalledWith('tok-enlace');

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await usuario.type(await screen.findByLabelText('Correo'), 'ana@correo.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Pepian2026');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(window.location.pathname).toBe(RUTA));
    await usuario.click(await screen.findByRole('button', { name: 'Unirme a Familia Rosales' }));
    expect(apiHogar.aceptarInvitacion).toHaveBeenCalledWith('tok-enlace');
    await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
    expect(await screen.findByText('Inicio', { selector: 'ion-label' })).toBeInTheDocument();
  });

  it('CA-02.2 sin cuenta: pasa por "Crear cuenta" (y de ahí a "Iniciar sesión") sin perder el enlace', async () => {
    renderizarApp(RUTA);
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('button', { name: 'Crear cuenta' }));
    expect(await screen.findByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Iniciar sesión' }));
    await usuario.click(await screen.findByRole('link', { name: 'Crear cuenta' }));
    await usuario.type(await screen.findByLabelText('Nombre'), 'Ana');
    await usuario.type(screen.getByLabelText('Correo'), 'ana@correo.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Pepian2026');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() => expect(window.location.pathname).toBe(RUTA));
    expect(
      await screen.findByRole('button', { name: 'Unirme a Familia Rosales' }),
    ).toBeInTheDocument();
  });

  it('CA-02.3 invitación vencida: "Invitación no válida, pide una nueva" y no se une', async () => {
    const apiHogar = apiHogarFalsa({ verInvitacion: vi.fn().mockRejectedValue(vencida()) });
    renderizarApp(RUTA, apiFalsa(), clienteFalso(), apiHogar);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invitación no válida, pide una nueva',
    );
    expect(screen.getByRole('link', { name: 'Ir a iniciar sesión' })).toBeInTheDocument();
    expect(apiHogar.aceptarInvitacion).not.toHaveBeenCalled();
  });

  it('CA-02.3 el enlace se usó mientras tanto: al aceptar muestra que no es válida', async () => {
    const apiHogar = apiHogarFalsa({ aceptarInvitacion: vi.fn().mockRejectedValue(vencida()) });
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });
    renderizarApp(RUTA, api, clienteFalso(), apiHogar);
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Unirme a Familia Rosales' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invitación no válida, pide una nueva',
    );
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toBeInTheDocument();
  });

  it('CA-02.4 con hogar: "Tu cuenta ya pertenece a un hogar" y no puede unirse', async () => {
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) });
    const { apiHogar } = renderizarApp(RUTA, api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta ya pertenece a un hogar');
    expect(screen.queryByRole('button', { name: /Unirme/ })).toBeNull();
    expect(apiHogar.aceptarInvitacion).not.toHaveBeenCalled();
  });

  it('CA-02.4 la API rechaza la unión (ya tiene hogar u otro correo): muestra el motivo', async () => {
    const apiHogar = apiHogarFalsa({
      verInvitacion: vi.fn().mockResolvedValue({
        hogarNombre: 'Familia Rosales',
        invitadoPor: 'Rene',
        medio: 'CORREO',
        correo: 'a**@correo.com',
        venceEn: '2026-10-29T15:00:00.000Z',
      }),
      aceptarInvitacion: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'YA_TIENE_HOGAR',
          detail: 'Tu cuenta ya pertenece a un hogar',
        }),
      ),
    });
    const api = apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });
    renderizarApp(RUTA, api, clienteFalso(), apiHogar);
    expect(await screen.findByText(/Es para la cuenta a\*\*@correo.com/)).toBeInTheDocument();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Unirme a Familia Rosales' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta ya pertenece a un hogar');
    expect(screen.getByRole('button', { name: 'Unirme a Familia Rosales' })).toBeEnabled();
  });

  it('sin conexión al abrir el enlace: muestra el motivo', async () => {
    const apiHogar = apiHogarFalsa({
      verInvitacion: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()),
    });
    renderizarApp(RUTA, apiFalsa(), clienteFalso(), apiHogar);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas conexión para iniciar sesión',
    );
  });
});
