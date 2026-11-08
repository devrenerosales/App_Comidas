import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Semana from './Semana';

const espacio = (
  id: string,
  fecha: string,
  nombre: string | null,
  extra: Partial<DetalleMenu> = {},
): DetalleMenu => ({
  id,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: nombre ? { id: `p-${id}`, nombre, proteinaPrincipal: 'RES' } : null,
  fijado: false,
  origen: 'MOTOR',
  puntaje: null,
  costoEstimado: null,
  costoIncompleto: true,
  reglasAplicadas: [],
  ...extra,
});

/** CA-23.1: lunes Carne guisada, martes Pescado frito, miércoles Tortitas de carne y jueves vacío. */
const menu = (
  estado: MenuGenerado['estado'] = 'BORRADOR',
  detalles: DetalleMenu[] = [
    espacio('lun', '2026-11-02', 'Carne guisada'),
    espacio('mar', '2026-11-03', 'Pescado frito'),
    espacio('mie', '2026-11-04', 'Tortitas de carne'),
    espacio('jue', '2026-11-05', null),
  ],
): MenuGenerado => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado,
  version: 1,
  presupuestoSemanal: '245.00',
  costoEstimado: null,
  costoIncompleto: true,
  excede: null,
  aprobadoPor: null,
  aprobadoEn: null,
  listaId: null,
  tiempos: [
    {
      tiempo: 'ALMUERZO',
      porcentaje: '100.00',
      presupuesto: '245.00',
      costoEstimado: null,
      exceso: '0.00',
      estado: 'COSTO_INCOMPLETO',
    },
  ],
  detalles,
  avisos: [],
});

async function abrir(inicial: MenuGenerado, alternativa = vi.fn()) {
  const menus = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar: vi.fn(),
    mover: vi.fn(),
    fijar: vi.fn(),
    aprobar: vi.fn(),
    motivo: vi.fn(),
    alternativa,
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

const otraOpcion = (dia: string) =>
  screen.getByRole('button', { name: `Otra opción para ${dia} almuerzo` });

describe('HU-23 Pedir otra opción para un día', () => {
  it('CA-23.1 con un toque cambia solo el martes y el resto de la semana no cambia', async () => {
    const cambiado = menu('BORRADOR', [
      espacio('lun', '2026-11-02', 'Carne guisada'),
      espacio('mar', '2026-11-03', 'Pollo en crema', { origen: 'ALTERNATIVA' }),
      espacio('mie', '2026-11-04', 'Tortitas de carne'),
      espacio('jue', '2026-11-05', null),
    ]);
    const alternativa = vi.fn().mockResolvedValue(cambiado);
    const { user } = await abrir(menu(), alternativa);

    await user.click(otraOpcion('Martes 03/11'));

    expect(alternativa).toHaveBeenCalledWith('m1', 'mar');
    expect(await screen.findByText('Pollo en crema')).toBeVisible();
    expect(screen.queryByText('Pescado frito')).not.toBeInTheDocument();
    expect(screen.getByText('Carne guisada')).toBeVisible();
    expect(screen.getByText('Tortitas de carne')).toBeVisible();
    expect(alternativa).toHaveBeenCalledTimes(1);
  });

  it('CA-23.3 sin más alternativas avisa y el día conserva su platillo', async () => {
    const alternativa = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 422,
        codigo: 'SIN_ALTERNATIVAS',
        detail: 'No hay más alternativas para este día',
      }),
    );
    const { user } = await abrir(menu(), alternativa);

    await user.click(otraOpcion('Martes 03/11'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay más alternativas para este día',
    );
    expect(screen.getByText('Pescado frito')).toBeVisible();
  });

  it('CA-23.4 con el platillo fijado la opción está deshabilitada', async () => {
    const fijado = menu('BORRADOR', [
      espacio('dom', '2026-11-01', 'Pepián de pollo', { fijado: true }),
      espacio('lun', '2026-11-02', 'Carne guisada'),
    ]);
    const { user } = await abrir(fijado);

    const boton = otraOpcion('Domingo 01/11');
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('title', 'Quita el fijado para pedir otra opción');
    await user.click(boton);
    expect(otraOpcion('Lunes 02/11')).toBeEnabled();
  });

  it('un espacio sin sugerencia también puede pedir otra opción', async () => {
    const cambiado = menu('BORRADOR', [espacio('jue', '2026-11-05', 'Pollo en crema')]);
    const alternativa = vi.fn().mockResolvedValue(cambiado);
    const { user } = await abrir(menu(), alternativa);

    await user.click(otraOpcion('Jueves 05/11'));

    expect(alternativa).toHaveBeenCalledWith('m1', 'jue');
    expect(await screen.findByText('Pollo en crema')).toBeVisible();
  });

  it('en un menú histórico la opción no está disponible', async () => {
    await abrir(menu('HISTORICO'));
    expect(screen.queryByRole('button', { name: /Otra opción/ })).not.toBeInTheDocument();
  });

  it('en un menú aprobado la opción sigue disponible', async () => {
    await abrir(menu('APROBADO'));
    expect(screen.getAllByRole('button', { name: /Otra opción/ }).length).toBeGreaterThan(0);
  });

  it('mientras se pide una alternativa no se puede pedir otra', async () => {
    let resolver: (m: MenuGenerado) => void = () => undefined;
    const alternativa = vi.fn().mockReturnValue(new Promise<MenuGenerado>((r) => (resolver = r)));
    const { user } = await abrir(menu(), alternativa);

    await user.click(otraOpcion('Martes 03/11'));

    await waitFor(() => expect(otraOpcion('Lunes 02/11')).toBeDisabled());
    resolver(menu());
    await waitFor(() => expect(otraOpcion('Lunes 02/11')).toBeEnabled());
  });
});
