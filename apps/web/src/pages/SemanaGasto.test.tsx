import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, GastoRegistrado, MenuGenerado } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Semana from './Semana';

/** CA-27.1: menú de la semana 2026-11-01 con costo estimado Q229.50 y presupuesto Q245.00. */
const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'APROBADO',
  version: 5,
  presupuestoSemanal: '245.00',
  costoEstimado: '229.50',
  costoIncompleto: false,
  excede: null,
  aprobadoPor: { id: 'u1', nombre: 'Ana' },
  aprobadoEn: '2026-11-02T15:10:00.000Z',
  listaId: 'l1',
  gasto: null,
  gastoSugerido: null,
  tiempos: [
    {
      tiempo: 'ALMUERZO',
      porcentaje: '100.00',
      presupuesto: '245.00',
      costoEstimado: '229.50',
      exceso: '0.00',
      estado: 'DENTRO_DEL_PRESUPUESTO',
    },
  ],
  detalles: [
    {
      id: 'lun',
      fecha: '2026-11-02',
      tiempo: 'ALMUERZO',
      platillo: { id: 'p1', nombre: 'Carne guisada', proteinaPrincipal: 'RES' },
      fijado: false,
      origen: 'MOTOR',
      puntaje: null,
      costoEstimado: '229.50',
      costoIncompleto: false,
      reglasAplicadas: [],
    },
  ],
  avisos: [],
  ...extra,
});

const gasto = (monto: string, extra: Partial<GastoRegistrado> = {}): GastoRegistrado => ({
  gastoReal: monto,
  nota: null,
  diferenciaVsEstimado: null,
  diferenciaVsPresupuesto: null,
  registradoPor: { id: 'u1', nombre: 'Ana' },
  registradoEn: '2026-11-08T16:00:00.000Z',
  ...extra,
});

const gasto23875 = gasto('238.75', {
  diferenciaVsEstimado: { monto: '9.25', texto: 'Q9.25 más que lo estimado' },
  diferenciaVsPresupuesto: { monto: '-6.25', texto: 'Q6.25 por debajo del presupuesto' },
});

async function abrir(inicial: MenuGenerado, registrarGasto = vi.fn()) {
  const menus = {
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    registrarGasto,
  };
  const configuracion = {
    obtenerSemana: vi
      .fn()
      .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
  };
  render(
    <MemoryRouter>
      <ContextoApiConfiguracion.Provider value={configuracion as unknown as ApiConfiguracion}>
        <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
          <Semana />
        </ContextoApiMenus.Provider>
      </ContextoApiConfiguracion.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('table', { name: 'Menú de la semana' });
  return { menus, user: userEvent.setup() };
}

const botonRegistrar = () => screen.queryByRole('button', { name: 'Registrar gasto real' });

describe('HU-27 Registrar el gasto real de la semana', () => {
  it('CA-27.1 registrar Q238.75 lo envía y muestra las diferencias', async () => {
    const registrar = vi.fn().mockResolvedValue(gasto23875);
    const { user } = await abrir(menu(), registrar);
    expect(screen.getByText('Todavía no registras lo que gastaste esta semana.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));
    await user.type(screen.getByLabelText('Monto gastado (Q)'), '238.75');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));

    await waitFor(() => expect(registrar).toHaveBeenCalledWith('m1', '238.75', undefined));
    expect(await screen.findByText('Q9.25 más que lo estimado')).toBeVisible();
    expect(screen.getByText('Q6.25 por debajo del presupuesto')).toBeVisible();
    expect(screen.getByText(/Gasto real:/).parentElement).toHaveTextContent('Q238.75');
    expect(screen.getByText(/Registrado por Ana el 08\/11/)).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Registrar gasto real' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corregir gasto' })).toBeVisible();
  });

  it('envía la nota cuando se escribe', async () => {
    const registrar = vi.fn().mockResolvedValue(gasto('240.00', { nota: 'Paiz y mercado' }));
    const { user } = await abrir(menu(), registrar);

    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));
    await user.type(screen.getByLabelText('Monto gastado (Q)'), '240');
    await user.type(screen.getByLabelText('Nota (opcional)'), ' Paiz y mercado ');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));

    await waitFor(() => expect(registrar).toHaveBeenCalledWith('m1', '240', 'Paiz y mercado'));
    expect(await screen.findByText('Nota: Paiz y mercado')).toBeVisible();
  });

  it('CA-27.2 corregir el gasto parte del valor registrado y muestra la nueva diferencia', async () => {
    const corregido = gasto('251.40', {
      diferenciaVsEstimado: { monto: '21.90', texto: 'Q21.90 más que lo estimado' },
      diferenciaVsPresupuesto: { monto: '6.40', texto: 'Q6.40 por encima del presupuesto' },
    });
    const registrar = vi.fn().mockResolvedValue(corregido);
    const { user } = await abrir(menu({ gasto: gasto23875 }), registrar);
    expect(screen.getByText('Q6.25 por debajo del presupuesto')).toBeVisible();
    expect(botonRegistrar()).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Corregir gasto' }));
    const campo = screen.getByLabelText('Monto gastado (Q)');
    expect(campo).toHaveValue('238.75');
    await user.clear(campo);
    await user.type(campo, '251.40');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));

    await waitFor(() => expect(registrar).toHaveBeenCalledWith('m1', '251.40', undefined));
    expect(await screen.findByText('Q6.40 por encima del presupuesto')).toBeVisible();
    expect(screen.queryByText('Q6.25 por debajo del presupuesto')).not.toBeInTheDocument();
  });

  it.each([
    ['0', 'El monto debe ser mayor que Q0.00'],
    ['-15.00', 'El monto debe ser mayor que Q0.00'],
    ['120.555', 'El monto admite como máximo 2 decimales'],
    ['', 'Escribe un monto válido'],
  ])('CA-27.3 el monto "%s" muestra "%s" y no se envía', async (monto, mensaje) => {
    const registrar = vi.fn();
    const { user } = await abrir(menu(), registrar);

    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));
    if (monto) await user.type(screen.getByLabelText('Monto gastado (Q)'), monto);
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('CA-27.4 un Borrador no ofrece registrar el gasto', async () => {
    await abrir(menu({ estado: 'BORRADOR', listaId: null, costoEstimado: null }));
    expect(botonRegistrar()).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Gasto real' })).not.toBeInTheDocument();
  });

  it('CU-06.4 2b prellena el monto con la suma de los precios de la lista', async () => {
    const { user } = await abrir(menu({ gastoSugerido: '73.60' }));

    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));

    expect(screen.getByLabelText('Monto gastado (Q)')).toHaveValue('73.60');
    expect(screen.getByText(/Sugerido con los precios que anotaste/)).toBeVisible();
  });

  it('con un gasto ya registrado no se prellena con la sugerencia', async () => {
    const { user } = await abrir(menu({ gasto: gasto23875, gastoSugerido: '73.60' }));
    await user.click(screen.getByRole('button', { name: 'Corregir gasto' }));
    expect(screen.getByLabelText('Monto gastado (Q)')).toHaveValue('238.75');
    expect(screen.queryByText(/Sugerido con los precios/)).not.toBeInTheDocument();
  });

  it('un error del servidor se muestra y deja reintentar', async () => {
    const registrar = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({
          status: 409,
          codigo: 'MENU_NO_APROBADO',
          detail: 'Aprueba el menú para registrar el gasto real',
        }),
      )
      .mockResolvedValue(gasto23875);
    const { user } = await abrir(menu(), registrar);

    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));
    await user.type(screen.getByLabelText('Monto gastado (Q)'), '238.75');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aprueba el menú para registrar el gasto real',
    );

    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));
    expect(await screen.findByText('Q9.25 más que lo estimado')).toBeVisible();
    expect(registrar).toHaveBeenCalledTimes(2);
  });

  it('cancelar cierra el formulario sin enviar', async () => {
    const registrar = vi.fn();
    const { user } = await abrir(menu(), registrar);
    await user.click(screen.getByRole('button', { name: 'Registrar gasto real' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Registrar gasto real' })).not.toBeInTheDocument();
    expect(botonRegistrar()).toBeVisible();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('un gasto sin comparaciones ni registrador (importado) se muestra solo con el monto', async () => {
    await abrir(menu({ gasto: gasto('224.00', { registradoPor: null, registradoEn: null }) }));
    expect(screen.getByText(/Gasto real:/).parentElement).toHaveTextContent('Q224.00');
    expect(screen.queryByText(/Registrado por/)).not.toBeInTheDocument();
  });
});
