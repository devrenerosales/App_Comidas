import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import RecuperarContrasena from './RecuperarContrasena';
import RestablecerContrasena from './RestablecerContrasena';

const TOKEN = 'x'.repeat(43);
function recuperar(api = { recuperar: vi.fn().mockResolvedValue({ mensaje: 'x' }) }) {
  render(
    <MemoryRouter>
      <RecuperarContrasena api={api} />
    </MemoryRouter>,
  );
  return api;
}
function restablecer(extra = {}, token = TOKEN) {
  const api = {
    validarRecuperacion: vi.fn().mockResolvedValue(undefined),
    restablecer: vi.fn().mockResolvedValue({ mensaje: 'Contraseña actualizada' }),
    ...extra,
  };
  render(
    <MemoryRouter initialEntries={[`/restablecer/${token}`]}>
      <Route path="/restablecer/:token">
        <RestablecerContrasena api={api} />
      </Route>
    </MemoryRouter>,
  );
  return api;
}
const invalido = () =>
  new ProblemaApi({
    status: 410,
    codigo: 'ENLACE_NO_VALIDO',
    detail: 'El enlace no es válido, solicita uno nuevo',
  });

describe('HU-04 Recuperación de contraseña', () => {
  it('CA-04.2 solicita el enlace y muestra el mensaje neutro', async () => {
    const api = recuperar();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Correo'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(api.recuperar).toHaveBeenCalledWith('ana@correo.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si el correo existe, recibirás un enlace',
    );
  });

  it('valida el correo y permite reintentar ante un error de red', async () => {
    const api = recuperar({ recuperar: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()) });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(api.recuperar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un correo válido');
    await user.type(screen.getByLabelText('Correo'), 'ana@correo.com');
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Necesitas conexión');
    expect(screen.getByRole('button', { name: 'Enviar enlace' })).toBeEnabled();
  });

  it('CA-04.1 confirma la nueva contraseña y ofrece iniciar sesión', async () => {
    const api = restablecer();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nueva contraseña'), 'PepianDePollo9');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'PepianDePollo9');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(api.restablecer).toHaveBeenCalledWith(TOKEN, 'PepianDePollo9', 'PepianDePollo9');
    expect(
      await screen.findByRole('heading', { name: 'Contraseña actualizada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
  });

  it.each([
    ['vencido', { validarRecuperacion: vi.fn().mockRejectedValue(invalido()) }, TOKEN],
    ['mal formado', {}, 'malo'],
  ] as const)('CA-04.3 al abrir un enlace %s ofrece solicitar otro', async (_, extra, token) => {
    const api = restablecer(extra, token);
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido');
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toHaveAttribute(
      'href',
      '/recuperar',
    );
    expect(api.restablecer).not.toHaveBeenCalled();
  });

  it('no envía una contraseña débil ni una confirmación distinta', async () => {
    const api = restablecer();
    const user = userEvent.setup();
    const campo = await screen.findByLabelText('Nueva contraseña');
    await user.type(campo, 'pollo');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(api.restablecer).not.toHaveBeenCalled();
    await user.clear(campo);
    await user.type(campo, 'PepianDePollo9');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'OtraContrasena9');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(api.restablecer).not.toHaveBeenCalled();
  });

  it('si el enlace se consume después de abrirlo, muestra que ya no es válido', async () => {
    restablecer({ restablecer: vi.fn().mockRejectedValue(invalido()) });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Nueva contraseña'), 'PepianDePollo9');
    await user.type(screen.getByLabelText('Confirmar contraseña'), 'PepianDePollo9');
    await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El enlace no es válido');
  });
});
