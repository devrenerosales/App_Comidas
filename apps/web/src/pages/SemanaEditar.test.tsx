import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo } from '../api/catalogo';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { AdvertenciaPlan, ApiMenus, DetalleMenu, MenuGenerado } from '../api/menus';
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

/** CA-24.1: lunes Carne guisada, miércoles Pescado, jueves Pepián, viernes Spaghetti. */
const menu = (estado: MenuGenerado['estado'] = 'BORRADOR'): MenuGenerado => ({
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
  detalles: [
    espacio('lun', '2026-11-02', 'Carne guisada'),
    espacio('mar', '2026-11-03', 'Tortitas de carne'),
    espacio('mie', '2026-11-04', 'Pescado frito'),
    espacio('jue', '2026-11-05', 'Pepián de pollo'),
    espacio('vie', '2026-11-06', 'Spaghetti con carne'),
    espacio('sab', '2026-11-07', null),
  ],
  avisos: [],
});

const problema = (status: number, codigo: string, detail: string, extra = {}) =>
  new ProblemaApi({ status, codigo, detail, ...extra });
const advertencia: AdvertenciaPlan = {
  codigo: 'RN02_PROTEINA_CONSECUTIVA',
  fecha: '2026-11-05',
  tiempo: 'ALMUERZO',
  mensaje: 'Proteína res repetida en días consecutivos (jueves y viernes)',
};

async function abrir(
  inicial: MenuGenerado = menu(),
  extra: Partial<Record<keyof ApiMenus, unknown>> = {},
) {
  const base = {
    generar: vi.fn(),
    obtenerPorSemana: vi.fn().mockResolvedValue(inicial),
    editar: vi.fn(),
    mover: vi.fn(),
    fijar: vi.fn(),
  };
  const menus = { ...base, ...extra } as typeof base;
  const catalogo = {
    listarPlatillos: vi.fn().mockResolvedValue({
      datos: [{ id: 'chile', nombre: 'Chile relleno' }],
      paginacion: {},
    }),
  };
  const configuracion = {
    obtenerSemana: vi
      .fn()
      .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
  };
  render(
    <MemoryRouter>
      <ContextoApiConfiguracion.Provider value={configuracion as unknown as ApiConfiguracion}>
        <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
          <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
            <Semana />
          </ContextoApiMenus.Provider>
        </ContextoApiCatalogo.Provider>
      </ContextoApiConfiguracion.Provider>
    </MemoryRouter>,
  );
  await screen.findByRole('table', { name: 'Menú de la semana' });
  return { menus, catalogo, user: userEvent.setup() };
}

const conPlatillo = (m: MenuGenerado, id: string, nombre: string | null, fijado = true) => ({
  ...m,
  detalles: m.detalles.map((d) =>
    d.id === id ? espacio(id, d.fecha, nombre, { fijado, origen: 'USUARIO' }) : d,
  ),
});

describe('HU-24 Abrir el menú de la semana', () => {
  it('al elegir la semana abre el menú que ya existe', async () => {
    const { menus } = await abrir();
    expect(menus.obtenerPorSemana).toHaveBeenCalledWith('2026-11-01');
    expect(
      screen.getByRole('heading', { name: 'Borrador del 01/11 al 07/11' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Carne guisada')).toBeInTheDocument();
  });

  it('cambiar de semana vuelve a buscar su menú', async () => {
    const { menus, user } = await abrir();
    menus.obtenerPorSemana.mockRejectedValue(problema(404, 'SIN_MENU', 'Sin menú'));
    await user.selectOptions(screen.getByLabelText('Semana'), '2026-11-08');
    await waitFor(() => expect(menus.obtenerPorSemana).toHaveBeenLastCalledWith('2026-11-08'));
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
  });

  it('un error al abrir el menú que no sea "sin menú" se muestra', async () => {
    const obtenerPorSemana = vi.fn().mockRejectedValue(problema(500, 'ERROR', 'Falló el servidor'));
    const menus = { generar: vi.fn(), obtenerPorSemana };
    render(
      <MemoryRouter>
        <ContextoApiConfiguracion.Provider
          value={
            {
              obtenerSemana: vi
                .fn()
                .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
            } as unknown as ApiConfiguracion
          }
        >
          <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
            <Semana />
          </ContextoApiMenus.Provider>
        </ContextoApiConfiguracion.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
  });
});

describe('HU-24 Mover platillos', () => {
  it('CA-24.1 mover lunes a jueves avisa RN-02 y, confirmado, intercambia y fija', async () => {
    const movido = {
      ...menu(),
      detalles: menu().detalles.map((d) =>
        d.id === 'lun'
          ? espacio('lun', d.fecha, 'Pepián de pollo', { fijado: true })
          : d.id === 'jue'
            ? espacio('jue', d.fecha, 'Carne guisada', { fijado: true })
            : d,
      ),
    };
    const mover = vi
      .fn()
      .mockRejectedValueOnce(
        problema(409, 'CONFIRMACION_REQUERIDA', 'Confirma', { advertencias: [advertencia] }),
      )
      .mockResolvedValue(movido);
    const { menus, user } = await abrir(menu(), { mover });
    await user.click(screen.getByRole('button', { name: 'Mover Lunes 02/11 almuerzo' }));
    expect(screen.getByText(/Elige el espacio de destino/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mover aquí a Jueves 05/11 almuerzo' }));

    const dialogo = await screen.findByRole('alertdialog', { name: 'Confirmar cambio' });
    expect(
      within(dialogo).getByText('Proteína res repetida en días consecutivos (jueves y viernes)'),
    ).toBeInTheDocument();
    expect(menus.mover).toHaveBeenLastCalledWith('m1', {
      origenDetalleId: 'lun',
      destinoDetalleId: 'jue',
    });

    await user.click(within(dialogo).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(menus.mover).toHaveBeenLastCalledWith('m1', {
        origenDetalleId: 'lun',
        destinoDetalleId: 'jue',
        confirmar: true,
      }),
    );
    const filas = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(filas[1]!).getByText('Pepián de pollo')).toBeInTheDocument();
    expect(within(filas[4]!).getByText('Carne guisada')).toBeInTheDocument();
    expect(within(filas[4]!).getByText('(fijado)')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancelar la advertencia no reintenta el cambio', async () => {
    const mover = vi
      .fn()
      .mockRejectedValue(
        problema(409, 'CONFIRMACION_REQUERIDA', 'Confirma', { advertencias: [advertencia] }),
      );
    const { user } = await abrir(menu(), { mover });
    await user.click(screen.getByRole('button', { name: 'Mover Lunes 02/11 almuerzo' }));
    await user.click(screen.getByRole('button', { name: 'Mover aquí a Jueves 05/11 almuerzo' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar cambio' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mover).toHaveBeenCalledTimes(1);
  });

  it('un intercambio sin conflictos se guarda de inmediato', async () => {
    const mover = vi.fn().mockResolvedValue(conPlatillo(menu(), 'sab', 'Pescado frito'));
    const { menus, user } = await abrir(menu(), { mover });
    await user.click(screen.getByRole('button', { name: 'Mover Miércoles 04/11 almuerzo' }));
    await user.click(screen.getByRole('button', { name: 'Mover aquí a Sábado 07/11 almuerzo' }));
    await waitFor(() => expect(menus.mover).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Elige el espacio de destino/)).not.toBeInTheDocument();
  });

  it('se puede arrastrar un platillo a otro día con el ratón', async () => {
    const mover = vi.fn().mockResolvedValue(menu());
    const { menus } = await abrir(menu(), { mover });
    const celdas = within(screen.getByRole('table')).getAllByRole('cell');
    const datos: Record<string, string> = {};
    const dataTransfer = {
      setData: (k: string, v: string) => {
        datos[k] = v;
      },
      getData: (k: string) => datos[k],
    };
    fireEvent.dragStart(celdas[0]!, { dataTransfer });
    fireEvent.dragOver(celdas[3]!, { dataTransfer });
    fireEvent.drop(celdas[3]!, { dataTransfer });
    await waitFor(() =>
      expect(menus.mover).toHaveBeenCalledWith('m1', {
        origenDetalleId: 'lun',
        destinoDetalleId: 'jue',
      }),
    );
    // Soltar sobre el mismo espacio no hace nada.
    fireEvent.drop(celdas[3]!, {
      dataTransfer: { getData: () => 'jue', setData: () => undefined },
    });
    expect(menus.mover).toHaveBeenCalledTimes(1);
  });

  it('cancelar el movimiento quita los botones "Mover aquí"', async () => {
    const { user } = await abrir();
    await user.click(screen.getByRole('button', { name: 'Mover Lunes 02/11 almuerzo' }));
    expect(screen.getAllByRole('button', { name: /Mover aquí a/ })).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Cancelar movimiento' }));
    expect(screen.queryByRole('button', { name: /Mover aquí a/ })).not.toBeInTheDocument();
  });

  it('CA-24.3 un tiempo donde no aplica muestra el motivo y el menú no cambia', async () => {
    const mover = vi
      .fn()
      .mockRejectedValue(problema(422, 'TIEMPO_NO_APLICABLE', 'Caldo de res no aplica a Desayuno'));
    const { user } = await abrir(menu(), { mover });
    await user.click(screen.getByRole('button', { name: 'Mover Lunes 02/11 almuerzo' }));
    await user.click(screen.getByRole('button', { name: 'Mover aquí a Jueves 05/11 almuerzo' }));
    expect(await screen.findByText('Caldo de res no aplica a Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Carne guisada')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('HU-24 Elegir y fijar platillos', () => {
  it('CA-24.2 elige "Chile relleno" para el martes y queda fijado', async () => {
    const editar = vi.fn().mockResolvedValue(conPlatillo(menu(), 'mar', 'Chile relleno'));
    const { menus, catalogo, user } = await abrir(menu(), { editar });
    await user.click(screen.getByRole('button', { name: 'Cambiar Martes 03/11 almuerzo' }));
    const panel = screen.getByRole('region', {
      name: 'Elegir platillo para Martes 03/11 almuerzo',
    });
    await user.type(within(panel).getByLabelText('Buscar platillo'), 'chi');
    expect(catalogo.listarPlatillos).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: 'chi', tiempo: 'ALMUERZO', estado: 'ACTIVO' }),
    );
    await user.click(await within(panel).findByRole('button', { name: 'Elegir Chile relleno' }));
    await waitFor(() =>
      expect(menus.editar).toHaveBeenCalledWith('m1', 'mar', { platilloId: 'chile' }),
    );
    const fila = within(screen.getByRole('table')).getAllByRole('row')[2]!;
    expect(within(fila).getByText('Chile relleno')).toBeInTheDocument();
    expect(within(fila).getByText('(fijado)')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Elegir platillo/ })).not.toBeInTheDocument();
  });

  it('elegir un platillo que repite proteína pide confirmar y se guarda al confirmar', async () => {
    const editar = vi
      .fn()
      .mockRejectedValueOnce(
        problema(409, 'CONFIRMACION_REQUERIDA', 'Confirma', { advertencias: [advertencia] }),
      )
      .mockResolvedValue(conPlatillo(menu(), 'mar', 'Chile relleno'));
    const { menus, user } = await abrir(menu(), { editar });
    await user.click(screen.getByRole('button', { name: 'Cambiar Martes 03/11 almuerzo' }));
    await user.type(screen.getByLabelText('Buscar platillo'), 'chi');
    await user.click(await screen.findByRole('button', { name: 'Elegir Chile relleno' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmar' }));
    await waitFor(() =>
      expect(menus.editar).toHaveBeenLastCalledWith('m1', 'mar', {
        platilloId: 'chile',
        confirmar: true,
      }),
    );
  });

  it('el selector avisa si no hay platillos, muestra errores y se puede cancelar', async () => {
    const { catalogo, user } = await abrir();
    await user.click(screen.getByRole('button', { name: 'Cambiar Sábado 07/11 almuerzo' }));
    catalogo.listarPlatillos.mockResolvedValueOnce({ datos: [], paginacion: {} });
    await user.type(screen.getByLabelText('Buscar platillo'), 'zz');
    expect(await screen.findByText('No hay platillos para «zz».')).toBeInTheDocument();
    catalogo.listarPlatillos.mockRejectedValue(problema(500, 'ERROR', 'Falló la búsqueda'));
    await user.type(screen.getByLabelText('Buscar platillo'), 'z');
    expect(await screen.findByText('Falló la búsqueda')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText('Buscar platillo')).not.toBeInTheDocument();
  });

  it('con menos de 2 letras no busca', async () => {
    const { catalogo, user } = await abrir();
    await user.click(screen.getByRole('button', { name: 'Cambiar Lunes 02/11 almuerzo' }));
    await user.type(screen.getByLabelText('Buscar platillo'), 'c');
    expect(catalogo.listarPlatillos).not.toHaveBeenCalled();
  });

  it('el candado fija y quita el fijado de un espacio', async () => {
    const fijar = vi
      .fn()
      .mockResolvedValueOnce(conPlatillo(menu(), 'lun', 'Carne guisada'))
      .mockResolvedValueOnce(menu());
    const { menus, user } = await abrir(menu(), { fijar });
    await user.click(screen.getByRole('button', { name: 'Fijar Lunes 02/11 almuerzo' }));
    await waitFor(() => expect(menus.fijar).toHaveBeenLastCalledWith('m1', 'lun', true));
    const quitar = await screen.findByRole('button', {
      name: 'Quitar fijado de Lunes 02/11 almuerzo',
    });
    expect(quitar).toHaveAttribute('aria-pressed', 'true');
    await user.click(quitar);
    await waitFor(() => expect(menus.fijar).toHaveBeenLastCalledWith('m1', 'lun', false));
    expect(
      await screen.findByRole('button', { name: 'Fijar Lunes 02/11 almuerzo' }),
    ).toBeInTheDocument();
  });

  it('un espacio sin platillo solo ofrece cambiar, no fijar ni mover', async () => {
    await abrir();
    expect(
      screen.getByRole('button', { name: 'Cambiar Sábado 07/11 almuerzo' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Fijar Sábado 07/11 almuerzo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Mover Sábado 07/11 almuerzo' }),
    ).not.toBeInTheDocument();
  });

  it('un error al fijar se muestra', async () => {
    const fijar = vi
      .fn()
      .mockRejectedValue(problema(409, 'MENU_APROBADO', 'El menú ya está aprobado'));
    const { user } = await abrir(menu(), { fijar });
    await user.click(screen.getByRole('button', { name: 'Fijar Lunes 02/11 almuerzo' }));
    expect(await screen.findByText('El menú ya está aprobado')).toBeInTheDocument();
  });
});

describe('Editar un menú aprobado', () => {
  it('un menú aprobado ofrece cambiar, fijar y mover, y avisa que la lista se ajusta', async () => {
    await abrir(menu('APROBADO'));
    expect(
      screen.getByRole('heading', { name: 'Menú aprobado del 01/11 al 07/11' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Este menú está aprobado\. Si cambias un platillo, la lista de compras/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Cambiar / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Fijar / }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Mover / }).length).toBeGreaterThan(0);
    // Y no se vuelve a aprobar.
    expect(screen.queryByRole('button', { name: 'Aprobar menú' })).not.toBeInTheDocument();
  });

  it('al cambiar un platillo de un menú aprobado confirma que la lista de compras se actualizó', async () => {
    const editar = vi.fn().mockResolvedValue(conPlatillo(menu('APROBADO'), 'mar', 'Chile relleno'));
    const { menus, user } = await abrir(menu('APROBADO'), { editar });
    await user.click(screen.getByRole('button', { name: 'Cambiar Martes 03/11 almuerzo' }));
    const panel = screen.getByRole('region', {
      name: 'Elegir platillo para Martes 03/11 almuerzo',
    });
    await user.type(within(panel).getByLabelText('Buscar platillo'), 'chi');
    await user.click(await within(panel).findByRole('button', { name: 'Elegir Chile relleno' }));
    await waitFor(() =>
      expect(menus.editar).toHaveBeenCalledWith('m1', 'mar', { platilloId: 'chile' }),
    );
    expect(
      await screen.findByText('Cambio guardado. La lista de compras se actualizó.'),
    ).toBeVisible();
  });

  it('en un borrador un cambio no habla de la lista de compras', async () => {
    const editar = vi.fn().mockResolvedValue(conPlatillo(menu(), 'mar', 'Chile relleno'));
    const { user } = await abrir(menu(), { editar });
    await user.click(screen.getByRole('button', { name: 'Cambiar Martes 03/11 almuerzo' }));
    const panel = screen.getByRole('region', {
      name: 'Elegir platillo para Martes 03/11 almuerzo',
    });
    await user.type(within(panel).getByLabelText('Buscar platillo'), 'chi');
    await user.click(await within(panel).findByRole('button', { name: 'Elegir Chile relleno' }));
    await waitFor(() => expect(editar).toHaveBeenCalled());
    expect(screen.queryByText(/La lista de compras se actualizó/)).not.toBeInTheDocument();
  });
});

describe('HU-24 Menú de solo lectura', () => {
  it('CA-24.4 un menú histórico no ofrece cambiar, fijar ni mover', async () => {
    const mover = vi.fn();
    const { menus } = await abrir(menu('HISTORICO'), { mover });
    expect(screen.queryByRole('button', { name: /^Cambiar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Fijar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mover / })).not.toBeInTheDocument();
    // Tampoco se puede arrastrar ni soltar.
    const celdas = within(screen.getByRole('table')).getAllByRole('cell');
    expect(celdas[0]).toHaveAttribute('draggable', 'false');
    fireEvent.drop(celdas[3]!, {
      dataTransfer: { getData: () => 'lun', setData: () => undefined },
    });
    expect(menus.mover).not.toHaveBeenCalled();
  });

  it('un menú histórico también es de solo lectura', async () => {
    await abrir(menu('HISTORICO'));
    expect(
      screen.getByRole('heading', { name: 'Menú histórico del 01/11 al 07/11' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Esta semana está en el historial: solo se puede consultar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Cambiar / })).not.toBeInTheDocument();
  });
});
