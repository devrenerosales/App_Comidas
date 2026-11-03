import type { CambioLista, ComidaDelMenu } from '@menu/shared';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiListas } from '../api/contexto-listas';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiListas, ItemLista, ListaCompras } from '../api/listas';
import type { ApiMenus, MenuGenerado } from '../api/menus';
import Lista from './Lista';
import { aplicarCambioLocal } from './lista-local';

/** Almacenamiento en memoria: el de Node/jsdom no es fiable entre versiones. */
const almacen = new Map<string, string>();
let enLinea = true;

beforeEach(() => {
  almacen.clear();
  enLinea = true;
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => void almacen.set(k, v),
  });
  vi.spyOn(window.navigator, 'onLine', 'get').mockImplementation(() => enLinea);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const item = (
  id: string,
  nombre: string,
  estado: ItemLista['estado'],
  comidas: string[],
): ItemLista => ({
  id,
  producto: { id: `p-${id}`, nombre },
  cantidadRequerida: null,
  equivalente: null,
  cantidadComprar: '1',
  presentacion: null,
  origen: 'MENU',
  estado,
  sinConversion: false,
  comidas,
});

const comida = (
  menuDetalleId: string,
  fecha: string,
  nombre: string,
  tiempo: ComidaDelMenu['tiempo'] = 'ALMUERZO',
): ComidaDelMenu => ({
  menuDetalleId,
  fecha,
  tiempo,
  platillo: { id: `p-${menuDetalleId}`, nombre },
});

const lista = (items: ItemLista[], comidas: ComidaDelMenu[]): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-10-25', hasta: '2026-10-31' },
  version: 1,
  excede: null,
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  sinConversion: 0,
  items,
  comidas,
});

const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado =>
  ({
    id: 'm1',
    fechaInicio: '2026-10-25',
    fechaFin: '2026-10-31',
    estado: 'APROBADO',
    listaId: 'l1',
    ...extra,
  }) as MenuGenerado;

/** Pepián de pollo (miércoles 28/10) con 6 ingredientes y 4 comprados (CA-43.1). */
const PEPIAN = ['Pollo en piezas', 'Miltomate', 'Tomate', 'Cebolla', 'Pepitoria', 'Ajonjolí'];
const pepian = (comprados = 4): ItemLista[] =>
  PEPIAN.map((p, i) => item(`p${i}`, p, i < comprados ? 'COMPRADO' : 'PENDIENTE', ['mie']));
const COMIDA_PEPIAN = comida('mie', '2026-10-28', 'Pepián de pollo');

function montar(servidor: ListaCompras, opciones: { menu?: MenuGenerado } = {}) {
  let vigente = servidor;
  const sincronizar = vi.fn().mockImplementation((_id: string, cambios: CambioLista[]) => {
    vigente = cambios.reduce(aplicarCambioLocal, vigente);
    return Promise.resolve({
      version: 2,
      resultados: cambios.map((c) => ({ id: c.id, resultado: 'APLICADO' })),
      lista: vigente,
    });
  });
  const menus = { obtenerPorSemana: vi.fn().mockResolvedValue(opciones.menu ?? menu()) };
  const listas = { obtener: vi.fn().mockResolvedValue(servidor), sincronizar };
  const configuracion = {
    obtenerSemana: vi
      .fn()
      .mockResolvedValue({ proximaSemana: { desde: '2026-11-01', hasta: '2026-11-07' } }),
  };
  render(
    <MemoryRouter>
      <ContextoApiConfiguracion.Provider value={configuracion as unknown as ApiConfiguracion}>
        <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
          <ContextoApiListas.Provider value={listas as unknown as ApiListas}>
            <Lista />
          </ContextoApiListas.Provider>
        </ContextoApiMenus.Provider>
      </ContextoApiConfiguracion.Provider>
    </MemoryRouter>,
  );
  return { sincronizar, user: userEvent.setup() };
}

const vistaBoton = async (nombre: string) =>
  within(await screen.findByRole('group', { name: 'Vista de la lista' })).getByRole('button', {
    name: nombre,
  });

async function irAPorComida(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await vistaBoton('Por comida'));
  return screen.findByRole('region', { name: 'Avance por comida' });
}

const filaDe = (region: HTMLElement, texto: string) =>
  within(region).getByText(texto).closest('li')!;

describe('HU-43 Avance de compra por comida', () => {
  it('la lista abre en "Productos" y se puede pasar a "Por comida" y volver', async () => {
    const { user } = montar(lista(pepian(), [COMIDA_PEPIAN]));
    expect(await vistaBoton('Productos')).toHaveAttribute('aria-pressed', 'true');
    await irAPorComida(user);
    expect(await vistaBoton('Por comida')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('list', { name: 'Productos de la lista' })).not.toBeInTheDocument();

    await user.click(await vistaBoton('Productos'));
    expect(await screen.findByRole('list', { name: 'Productos de la lista' })).toBeInTheDocument();
  });

  it('CA-43.1 muestra "Pepián de pollo · miércoles almuerzo · 4 de 6" sin "Lista para preparar"', async () => {
    const { user } = montar(lista(pepian(), [COMIDA_PEPIAN]));
    const region = await irAPorComida(user);

    const fila = filaDe(region, 'Pepián de pollo · miércoles almuerzo · 4 de 6');
    expect(fila).not.toHaveTextContent('Lista para preparar');
    expect(
      within(fila).getByRole('progressbar', { name: 'Avance de Pepián de pollo' }),
    ).toHaveAttribute('value', '4');
    const pendientes = within(fila).getByRole('list', { name: 'Pendientes de Pepián de pollo' });
    expect(
      within(pendientes)
        .getAllByRole('listitem')
        .map((l) => l.textContent),
    ).toEqual([expect.stringContaining('Pepitoria'), expect.stringContaining('Ajonjolí')]);
  });

  it('CA-43.2 marcar Comprado y "Ya lo tengo" desde la comida la deja "6 de 6" y lista para preparar', async () => {
    const { user, sincronizar } = montar(lista(pepian(), [COMIDA_PEPIAN]));
    const region = await irAPorComida(user);

    await user.click(within(region).getByRole('button', { name: 'Comprado Pepitoria' }));
    await user.click(within(region).getByRole('button', { name: 'Ya lo tengo Ajonjolí' }));

    const fila = filaDe(region, 'Pepián de pollo · miércoles almuerzo · 6 de 6');
    expect(fila).toHaveTextContent('Lista para preparar');
    expect(within(fila).queryByRole('list', { name: /Pendientes/ })).not.toBeInTheDocument();
    expect(within(region).getByText('6 de 6 productos (100 %)')).toBeInTheDocument();
    await waitFor(() => expect(sincronizar).toHaveBeenCalled());
    const operaciones = sincronizar.mock.calls.flatMap((c) =>
      (c[1] as CambioLista[]).map((x) => [x.itemId, x.operacion]),
    );
    expect(operaciones).toEqual([
      ['p4', 'MARCAR_COMPRADO'],
      ['p5', 'MARCAR_YA_LO_TENGO'],
    ]);
  });

  it('CA-43.3 un producto compartido cuenta una sola vez en todas sus comidas', async () => {
    const comidas = [
      comida('a', '2026-10-26', 'Pepián de pollo'),
      comida('b', '2026-10-27', 'Carne guisada'),
      comida('c', '2026-10-28', 'Caldo de res'),
    ];
    const items = [
      item('ce', 'Cebolla', 'PENDIENTE', ['a', 'b', 'c']),
      item('x1', 'Papa', 'COMPRADO', ['b']),
      item('x2', 'Zanahoria', 'COMPRADO', ['c']),
      item('x3', 'Pollo', 'COMPRADO', ['a']),
    ];
    const { user } = montar(lista(items, comidas));
    const region = await irAPorComida(user);
    expect(
      within(region).getByText('Carne guisada · martes almuerzo · 1 de 2'),
    ).toBeInTheDocument();

    await user.click(within(region).getAllByRole('button', { name: 'Comprado Cebolla' })[0]!);

    expect(
      within(region).getByText('Pepián de pollo · lunes almuerzo · 2 de 2'),
    ).toBeInTheDocument();
    expect(
      within(region).getByText('Carne guisada · martes almuerzo · 2 de 2'),
    ).toBeInTheDocument();
    expect(
      within(region).getByText('Caldo de res · miércoles almuerzo · 2 de 2'),
    ).toBeInTheDocument();
  });

  it('CA-43.4 el avance general redondea: 18 de 31 productos (58 %)', async () => {
    const items = Array.from({ length: 31 }, (_, i) =>
      item(
        `i${i}`,
        `Producto ${i}`,
        i < 15 ? 'COMPRADO' : i < 18 ? 'YA_LO_TENGO' : 'PENDIENTE',
        [],
      ),
    );
    const { user } = montar(lista(items, []));
    const region = await irAPorComida(user);

    expect(within(region).getByText('18 de 31 productos (58 %)')).toBeInTheDocument();
    expect(
      within(region).getByText('Este menú no tiene comidas con platillo.'),
    ).toBeInTheDocument();
  });

  it('CA-43.5 sin conexión el avance se actualiza en el dispositivo y queda "1 cambio pendiente"', async () => {
    const tortitas = comida('t', '2026-10-27', 'Tortitas de carne');
    const items = [
      item('a', 'Carne molida', 'COMPRADO', ['t']),
      item('b', 'Huevos', 'COMPRADO', ['t']),
      item('c', 'Harina', 'COMPRADO', ['t']),
      item('d', 'Pan molido', 'PENDIENTE', ['t']),
    ];
    const { user, sincronizar } = montar(lista(items, [tortitas]));
    const region = await irAPorComida(user);
    expect(
      within(region).getByText('Tortitas de carne · martes almuerzo · 3 de 4'),
    ).toBeInTheDocument();
    enLinea = false;
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    await user.click(within(region).getByRole('button', { name: 'Comprado Pan molido' }));

    const fila = filaDe(region, 'Tortitas de carne · martes almuerzo · 4 de 4');
    expect(fila).toHaveTextContent('Lista para preparar');
    expect(screen.getByText('1 cambio pendiente')).toBeInTheDocument();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('CA-43.6 desmarcar un ingrediente de una comida lista le quita la marca', async () => {
    const pescado = comida('p', '2026-10-30', 'Pescado frito');
    const items = ['Pescado', 'Harina', 'Aceite', 'Limón'].map((n, i) =>
      item(`i${i}`, n, 'COMPRADO', ['p']),
    );
    const { user } = montar(lista(items, [pescado]));
    let region = await irAPorComida(user);
    expect(filaDe(region, 'Pescado frito · viernes almuerzo · 4 de 4')).toHaveTextContent(
      'Lista para preparar',
    );

    await user.click(await vistaBoton('Productos'));
    await user.click(await screen.findByRole('checkbox', { name: 'Marcar Limón como comprado' }));
    region = await irAPorComida(user);

    const fila = filaDe(region, 'Pescado frito · viernes almuerzo · 3 de 4');
    expect(fila).not.toHaveTextContent('Lista para preparar');
    expect(within(fila).getByText('Limón')).toBeInTheDocument();
  });

  it('E1 un producto agregado a mano cuenta solo en el avance general', async () => {
    const items = [
      item('a', 'Pollo', 'COMPRADO', ['mie']),
      { ...item('t', 'Tortillas', 'COMPRADO', []), origen: 'MANUAL' as const },
    ];
    const { user } = montar(lista(items, [COMIDA_PEPIAN]));
    const region = await irAPorComida(user);

    expect(within(region).getByText('2 de 2 productos (100 %)')).toBeInTheDocument();
    expect(
      within(region).getByText('Pepián de pollo · miércoles almuerzo · 1 de 1'),
    ).toBeInTheDocument();
  });

  it('E2 un platillo sin ingredientes dice "Sin ingredientes registrados" y nunca queda lista', async () => {
    const { user } = montar(lista([], [comida('arroz', '2026-10-26', 'Arroz blanco')]));
    const region = await irAPorComida(user);

    const fila = filaDe(region, 'Arroz blanco · lunes almuerzo');
    expect(fila).toHaveTextContent('Sin ingredientes registrados');
    expect(fila).not.toHaveTextContent('Lista para preparar');
    expect(within(fila).queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('con una copia antigua sin comidas muestra solo el avance general', async () => {
    const sinComidas = { ...lista(pepian(), []), comidas: undefined };
    const { user } = montar(sinComidas);
    const region = await irAPorComida(user);
    expect(within(region).getByText('4 de 6 productos (67 %)')).toBeInTheDocument();
  });

  it('en un menú que ya pasó al historial solo se consulta: sin botones de marcar', async () => {
    const { user } = montar(lista(pepian(), [COMIDA_PEPIAN]), {
      menu: menu({ estado: 'HISTORICO' }),
    });
    const region = await irAPorComida(user);

    expect(
      within(region).getByText('Pepián de pollo · miércoles almuerzo · 4 de 6'),
    ).toBeInTheDocument();
    expect(within(region).queryByRole('button', { name: /Comprado/ })).not.toBeInTheDocument();
    expect(within(region).getByText('Pepitoria')).toBeInTheDocument();
  });
});
