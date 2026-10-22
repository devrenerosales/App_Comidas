import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import { apiFalsa, renderizarApp } from '../test/utilidades';

async function llenar(nombre: string, correo: string, contrasena: string) {
  const usuario = userEvent.setup();
  await screen.findByRole('heading', { name: 'Crear cuenta' });
  if (nombre) await usuario.type(screen.getByLabelText('Nombre'), nombre);
  if (correo) await usuario.type(screen.getByLabelText('Correo'), correo);
  if (contrasena) await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
  await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  return usuario;
}

describe('Crear cuenta (HU-01)', () => {
  it('CA-01.1 registro exitoso: queda con sesión iniciada y la app lo lleva a "Crear hogar"', async () => {
    const { api } = renderizarApp('/registro');
    await llenar('Rene', 'rene@correo.com', 'Almuerzo2026');
    expect(api.registrar).toHaveBeenCalledWith({
      nombre: 'Rene',
      correo: 'rene@correo.com',
      contrasena: 'Almuerzo2026',
    });
    expect(await screen.findByRole('heading', { name: 'Crear hogar' })).toBeInTheDocument();
    expect(screen.getByText(/¡Hola, Rene!/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/crear-hogar');
  });

  it('CA-01.2 correo ya existente: muestra "Este correo ya tiene cuenta" y ofrece "Iniciar sesión"', async () => {
    const api = apiFalsa({
      registrar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'CORREO_REGISTRADO',
          detail: 'Este correo ya tiene cuenta',
        }),
      ),
    });
    renderizarApp('/registro', api);
    const usuario = await llenar('Rene', 'rene@correo.com', 'Almuerzo2026');
    expect(await screen.findByRole('alert')).toHaveTextContent('Este correo ya tiene cuenta');
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByLabelText('Correo')).toHaveValue('rene@correo.com');
  });

  it('CA-01.4 contraseña "pollo": muestra la política y no crea la cuenta', async () => {
    const { api } = renderizarApp('/registro');
    await llenar('Rene', 'rene@correo.com', 'pollo');
    const campo = screen.getByLabelText('Contraseña');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(
      'La contraseña debe tener al menos 8 caracteres, una letra y un número',
    );
    expect(api.registrar).not.toHaveBeenCalled();
  });

  it('CA-01.4 si la API responde 422 muestra el error en el campo', async () => {
    const api = apiFalsa({
      registrar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'CONTRASENA_DEBIL',
          detail: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
          errores: [
            {
              campo: 'contrasena',
              mensaje: 'La contraseña debe tener al menos 8 caracteres, una letra y un número',
            },
          ],
        }),
      ),
    });
    renderizarApp('/registro', api);
    await llenar('Rene', 'rene@correo.com', 'Almuerzo2026');
    expect(
      await screen.findByText(
        'La contraseña debe tener al menos 8 caracteres, una letra y un número',
      ),
    ).toBeInTheDocument();
  });

  it('valida nombre y correo antes de enviar', async () => {
    const { api } = renderizarApp('/registro');
    await llenar('', 'no-es-correo', 'Almuerzo2026');
    expect(screen.getByText('Ingresa tu nombre')).toBeInTheDocument();
    expect(screen.getByText('Ingresa un correo válido')).toBeInTheDocument();
    expect(api.registrar).not.toHaveBeenCalled();
  });

  it('sin conexión muestra "Necesitas conexión para iniciar sesión"', async () => {
    const api = apiFalsa({ registrar: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()) });
    renderizarApp('/registro', api);
    await llenar('Rene', 'rene@correo.com', 'Almuerzo2026');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Necesitas conexión para iniciar sesión',
    );
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
  });

  it('enlaza a "Iniciar sesión"', async () => {
    renderizarApp('/registro');
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('link', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });
});
