import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiMenus, DetalleMenu, MenuGenerado } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Semana from './Semana';

const FECHAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];
const detalle = (fecha: string, i: number, extra: Partial<DetalleMenu> = {}): DetalleMenu => ({
  id: `d${i}`,
  fecha,
  tiempo: 'ALMUERZO',
  platillo: { id: `p${i}`, nombre: `Platillo ${i + 1}`, proteinaPrincipal: 'POLLO' },
  fijado: false,
  origen: 'MOTOR',
  puntaje: '0.6000',
  costoEstimado: null,
  costoIncompleto: true,
  reglasAplicadas: [],
  ...extra,
});
const MENU: MenuGenerado = {
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'BORRADOR',
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
  detalles: FECHAS.map((f, i) => detalle(f, i)),
  avisos: [],
};

function abrir(
  menusExtra: Partial<Record<keyof ApiMenus, unknown>> = {},
  configExtra: Partial<Record<keyof ApiConfiguracion, unknown>> = {},
) {
  const menus = {
    generar: vi.fn().mockResolvedValue(MENU),
    // Sin menú todavía para la semana elegida (404 SIN_MENU).
    obtenerPorSemana: vi.fn().mockRejectedValue(problema(404, 'SIN_MENU', 'Sin menú')),
    ...menusExtra,
  };
  const configuracion = {
    obtenerSemana: vi.fn().mockResolvedValue({
      proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' },
    }),
    ...configExtra,
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
  return { menus, configuracion, user: userEvent.setup() };
}

const problema = (status: number, codigo: string, detail: string) =>
  new ProblemaApi({ status, codigo, detail });

describe('HU-19 Sugerir menú', () => {
  it('ofrece las próximas 4 semanas empezando por la que indica la configuración', async () => {
    abrir();
    const selector = await screen.findByLabelText('Semana');
    const opciones = within(selector)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opciones).toEqual([
      '01/11 al 07/11',
      '08/11 al 14/11',
      '15/11 al 21/11',
      '22/11 al 28/11',
    ]);
    expect(selector).toHaveValue('2026-11-01');
  });

  it('CA-19.1 muestra la grilla de 7 almuerzos de domingo a sábado con el presupuesto', async () => {
    const { menus, user } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    expect(menus.generar).toHaveBeenCalledWith({ semana: '2026-11-01' });
    const tabla = await screen.findByRole('table', { name: 'Menú de la semana' });
    const filas = within(tabla).getAllByRole('row');
    expect(filas).toHaveLength(8);
    expect(within(filas[0]!).getByRole('columnheader', { name: 'Almuerzo' })).toBeInTheDocument();
    expect(within(filas[1]!).getByRole('rowheader')).toHaveTextContent('Domingo 01/11');
    expect(within(filas[7]!).getByRole('rowheader')).toHaveTextContent('Sábado 07/11');
    expect(within(filas[1]!).getByText('Platillo 1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Borrador del 01/11 al 07/11' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Q245.00/, { selector: 'p' })).toBeInTheDocument();
    expect(
      screen.getByText('Costo estimado incompleto: todavía no hay precios para los ingredientes.'),
    ).toBeInTheDocument();
  });

  it('cambiar de semana pide esa semana', async () => {
    const { menus, user } = abrir();
    await user.selectOptions(await screen.findByLabelText('Semana'), '2026-11-08');
    await user.click(screen.getByRole('button', { name: 'Sugerir menú' }));
    await waitFor(() => expect(menus.generar).toHaveBeenCalledWith({ semana: '2026-11-08' }));
  });

  it('muestra dos tiempos, los fijados y "Sin sugerencia" con su aviso (E3)', async () => {
    const dos: MenuGenerado = {
      ...MENU,
      tiempos: [
        ...MENU.tiempos,
        { ...MENU.tiempos[0]!, tiempo: 'CENA', porcentaje: '40.00', presupuesto: '98.00' },
      ],
      detalles: [
        detalle('2026-11-01', 0, { fijado: true }),
        detalle('2026-11-01', 1, { tiempo: 'CENA' }),
        detalle('2026-11-02', 2, { platillo: null }),
        detalle('2026-11-02', 3, { tiempo: 'CENA' }),
      ],
      avisos: [
        {
          codigo: 'SIN_SUGERENCIA',
          fecha: '2026-11-02',
          tiempo: 'ALMUERZO',
          mensaje: 'Ningún platillo cumple RN-02 y RN-03 para este día',
        },
      ],
    };
    const { user } = abrir({ generar: vi.fn().mockResolvedValue(dos) });
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    expect(await screen.findByText('(fijado)')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cena' })).toBeInTheDocument();
    expect(screen.getByText('Sin sugerencia')).toBeInTheDocument();
    expect(
      screen.getByText(/Lunes 02\/11 · almuerzo: Ningún platillo cumple RN-02 y RN-03/),
    ).toBeInTheDocument();
    expect(screen.getByText('Cena: presupuesto Q98.00')).toBeInTheDocument();
  });

  it('CA-19.2 con un borrador existente pide confirmar y regenera conservando fijados', async () => {
    const generar = vi
      .fn()
      .mockRejectedValueOnce(problema(409, 'BORRADOR_EXISTENTE', 'Ya hay un borrador'))
      .mockResolvedValue(MENU);
    const { user } = abrir({ generar });
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    expect(await screen.findByText(/ya tiene un borrador/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Regenerar' }));
    await waitFor(() =>
      expect(generar).toHaveBeenLastCalledWith({ semana: '2026-11-01', regenerar: true }),
    );
    expect(await screen.findByRole('table', { name: 'Menú de la semana' })).toBeInTheDocument();
    expect(screen.queryByText(/ya tiene un borrador/)).not.toBeInTheDocument();
  });

  it('cancelar la regeneración conserva todo como estaba', async () => {
    const generar = vi.fn().mockRejectedValue(problema(409, 'BORRADOR_EXISTENTE', 'Ya hay uno'));
    const { user } = abrir({ generar });
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByText(/ya tiene un borrador/)).not.toBeInTheDocument();
    expect(generar).toHaveBeenCalledTimes(1);
  });

  it('CA-19.3 faltan platillos: muestra el mensaje y el enlace al catálogo', async () => {
    const { user } = abrir({
      generar: vi
        .fn()
        .mockRejectedValue(problema(422, 'FALTAN_PLATILLOS', 'Faltan 3 platillos de Cena')),
    });
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    expect(await screen.findByText('Faltan 3 platillos de Cena')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir al catálogo de platillos' })).toHaveAttribute(
      'href',
      '/platillos',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('CA-19.4 una semana aprobada muestra el aviso sin enlace al catálogo', async () => {
    const { user } = abrir({
      generar: vi
        .fn()
        .mockRejectedValue(problema(409, 'MENU_APROBADO', 'Esta semana ya tiene un menú aprobado')),
    });
    await user.click(await screen.findByRole('button', { name: 'Sugerir menú' }));
    expect(await screen.findByText('Esta semana ya tiene un menú aprobado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /catálogo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Regenerar' })).not.toBeInTheDocument();
  });

  it('un error al cargar la semana permite reintentar', async () => {
    const obtenerSemana = vi
      .fn()
      .mockRejectedValueOnce(problema(500, 'ERROR', 'Falló el servidor'))
      .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } });
    const { user } = abrir({}, { obtenerSemana });
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Semana')).toBeInTheDocument();
  });
});
