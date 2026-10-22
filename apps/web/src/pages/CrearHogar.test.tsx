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

const sinHogar = () => apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_SIN_HOGAR) });

async function crear(nombre: string) {
  const usuario = userEvent.setup();
  await screen.findByRole('heading', { name: 'Crear hogar' });
  if (nombre) await usuario.type(screen.getByLabelText('Nombre del hogar'), nombre);
  await usuario.click(screen.getByRole('button', { name: 'Crear hogar' }));
}

describe('Crear hogar (HU-02)', () => {
  it('CA-02.1 creo "Familia Rosales": quedo como Administrador y paso a invitar a mi familia', async () => {
    const { apiHogar } = renderizarApp('/crear-hogar', sinHogar());
    expect(await screen.findByText(/solo almuerzo, presupuesto de Q250/)).toBeInTheDocument();
    await crear('  Familia   Rosales ');
    expect(apiHogar.crearHogar).toHaveBeenCalledWith('Familia Rosales');
    await waitFor(() => expect(window.location.pathname).toBe('/configuracion/hogar'));
    expect(await screen.findByText(/Tu hogar está creado/)).toBeInTheDocument();
    expect(await screen.findByText('Administrador')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Miembros de Familia Rosales' })).toBeVisible();
  });

  it('CA-02.1 nombre vacío: "Ingresa el nombre del hogar" y no llama a la API', async () => {
    const { apiHogar } = renderizarApp('/crear-hogar', sinHogar());
    await crear('   ');
    expect(await screen.findByText('Ingresa el nombre del hogar')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del hogar')).toHaveAttribute('aria-invalid', 'true');
    expect(apiHogar.crearHogar).not.toHaveBeenCalled();
  });

  it('CA-02.1 la API rechaza el nombre: muestra el error del campo', async () => {
    const apiHogar = apiHogarFalsa({
      crearHogar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'NOMBRE_HOGAR_INVALIDO',
          detail: 'El nombre del hogar admite hasta 80 caracteres',
          errores: [{ campo: 'nombre', mensaje: 'El nombre del hogar admite hasta 80 caracteres' }],
        }),
      ),
    });
    renderizarApp('/crear-hogar', sinHogar(), clienteFalso(), apiHogar);
    await crear('Familia');
    expect(
      await screen.findByText('El nombre del hogar admite hasta 80 caracteres'),
    ).toBeInTheDocument();
  });

  it('CA-02.1 ya tiene hogar (otra pestaña): "Tu cuenta ya pertenece a un hogar"', async () => {
    const apiHogar = apiHogarFalsa({
      crearHogar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'YA_TIENE_HOGAR',
          detail: 'Tu cuenta ya pertenece a un hogar',
        }),
      ),
    });
    renderizarApp('/crear-hogar', sinHogar(), clienteFalso(), apiHogar);
    await crear('Familia Rosales');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta ya pertenece a un hogar');
    expect(screen.getByRole('button', { name: 'Crear hogar' })).toBeEnabled();
  });

  it('con hogar, "Crear hogar" lleva al inicio (un hogar por usuario)', async () => {
    renderizarApp(
      '/crear-hogar',
      apiFalsa({ restaurar: vi.fn().mockResolvedValue(SESION_CON_HOGAR) }),
    );
    await waitFor(() => expect(window.location.pathname).toBe('/inicio'));
  });

  it('sin hogar, una pestaña lleva a "Crear hogar"', async () => {
    renderizarApp('/semana', sinHogar());
    expect(await screen.findByRole('heading', { name: 'Crear hogar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/crear-hogar');
  });
});
