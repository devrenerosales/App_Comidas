import type { CambioLista } from '@menu/shared';
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

const item = (id: string, nombre: string, extra: Partial<ItemLista> = {}): ItemLista => ({
  id,
  producto: { id: `p-${id}`, nombre },
  cantidadRequerida: null,
  equivalente: null,
  cantidadComprar: '1',
  presentacion: { cantidad: '2', unidad: 'lb', unidadCompra: 'bolsa', texto: 'bolsa 2 lb' },
  origen: 'MENU',
  estado: 'PENDIENTE',
  sinConversion: false,
  comidas: [],
  ...extra,
});

const lista = (items: ItemLista[]): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-10-25', hasta: '2026-10-31' },
  version: 1,
  excede: null,
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  sinConversion: 0,
  items,
  comidas: [],
  gastoSugerido: '0.00',
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

const casilla = (nombre: string) =>
  screen.findByRole('checkbox', { name: `Marcar ${nombre} como comprado` });
const formulario = (nombre: string) => screen.findByRole('form', { name: `Precio de ${nombre}` });
const cambiosEnviados = (sincronizar: ReturnType<typeof vi.fn>) =>
  sincronizar.mock.calls.flatMap((c) => c[1] as CambioLista[]);

describe('HU-44 Precio real y promedio de compra', () => {
  it('CA-44.1 muestra el promedio de compra con la mediana como referencia', async () => {
    montar(
      lista([
        item('a', 'Pechuga de pollo', {
          promedioCompra: { precio: '27.20', compras: 3 },
          medianaMercado: '27.50',
        }),
        item('b', 'Tomate', { medianaMercado: '8.00' }),
        item('c', 'Cebolla', { promedioCompra: { precio: '5.00', compras: 1 } }),
        item('d', 'Arroz'),
      ]),
    );
    expect(
      await screen.findByText('Promedio de compra Q27.20 (3 compras) · Mediana Q27.50'),
    ).toBeInTheDocument();
    expect(screen.getByText('Mediana Q8.00')).toBeInTheDocument();
    expect(screen.getByText('Promedio de compra Q5.00 (1 compra)')).toBeInTheDocument();
  });

  it('CA-44.1 al marcar comprado ofrece anotar el precio y lo envía como cambio de precio', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Pechuga de pollo')]));

    await user.click(await casilla('Pechuga de pollo'));
    const form = await formulario('Pechuga de pollo');
    await user.type(within(form).getByLabelText('Precio pagado (Q)'), '28.10');
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    expect(
      screen.queryByRole('form', { name: 'Precio de Pechuga de pollo' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('Pagado Q28.10')).toBeInTheDocument();
    await waitFor(() => expect(cambiosEnviados(sincronizar)).toHaveLength(2));
    expect(cambiosEnviados(sincronizar).map((c) => [c.operacion, c.datos?.precioReal])).toEqual([
      ['MARCAR_COMPRADO', undefined],
      ['REGISTRAR_PRECIO', 28.1],
    ]);
  });

  it('CA-44.2 con otra presentación anota el contenido comprado', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Pechuga de pollo')]));

    await user.click(await casilla('Pechuga de pollo'));
    const form = await formulario('Pechuga de pollo');
    await user.type(within(form).getByLabelText('Precio pagado (Q)'), '66.25');
    await user.type(
      within(form).getByLabelText('Contenido comprado (lb), si no fue bolsa 2 lb'),
      '5',
    );
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    await waitFor(() => expect(cambiosEnviados(sincronizar)).toHaveLength(2));
    expect(cambiosEnviados(sincronizar)[1]!.datos).toEqual({
      precioReal: 66.25,
      contenidoComprado: 5,
    });
  });

  it('CA-44.5 un precio inválido muestra el mensaje y el producto queda comprado sin precio', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Cebolla')]));
    await user.click(await casilla('Cebolla'));
    const form = await formulario('Cebolla');
    const campo = within(form).getByLabelText('Precio pagado (Q)');
    const guardar = within(form).getByRole('button', { name: 'Guardar precio' });

    for (const [escrito, mensaje] of [
      ['0', 'El precio debe ser mayor que Q0.00'],
      ['-5.00', 'El precio debe ser mayor que Q0.00'],
      ['12.345', 'Usa máximo 2 decimales'],
    ] as const) {
      await user.clear(campo);
      await user.type(campo, escrito);
      await user.click(guardar);
      expect(within(form).getByRole('alert')).toHaveTextContent(mensaje);
    }

    expect(await casilla('Cebolla')).toBeChecked();
    expect(screen.queryByText(/^Pagado/)).not.toBeInTheDocument();
    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    expect(cambiosEnviados(sincronizar).map((c) => c.operacion)).toEqual(['MARCAR_COMPRADO']);
  });

  it('un contenido comprado inválido se avisa y no se envía el precio', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Cebolla')]));
    await user.click(await casilla('Cebolla'));
    const form = await formulario('Cebolla');
    await user.type(within(form).getByLabelText('Precio pagado (Q)'), '10');
    await user.type(within(form).getByLabelText(/Contenido comprado/), '0');

    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    expect(within(form).getByRole('alert')).toHaveTextContent(
      'El contenido comprado debe ser mayor que 0',
    );
    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
  });

  it('"Omitir precio" deja el producto comprado sin precio', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Cebolla')]));
    await user.click(await casilla('Cebolla'));
    const form = await formulario('Cebolla');

    await user.click(within(form).getByRole('button', { name: 'Omitir precio' }));

    expect(screen.queryByRole('form', { name: 'Precio de Cebolla' })).not.toBeInTheDocument();
    expect(await casilla('Cebolla')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Anotar precio de Cebolla' })).toBeInTheDocument();
    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
  });

  it('CA-44.6 sin conexión el precio viaja con la marca: "1 cambio pendiente" y se envía una sola vez', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Arroz'), item('b', 'Frijol')]));
    const arroz = await casilla('Arroz');
    enLinea = false;
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });

    await user.click(arroz);
    const form = await formulario('Arroz');
    await user.type(within(form).getByLabelText('Precio pagado (Q)'), '12.50');
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    expect(await screen.findByText('1 cambio pendiente')).toBeInTheDocument();
    expect(screen.getByText('Pagado Q12.50')).toBeInTheDocument();
    expect(sincronizar).not.toHaveBeenCalled();

    enLinea = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    expect(cambiosEnviados(sincronizar)).toEqual([
      expect.objectContaining({
        operacion: 'MARCAR_COMPRADO',
        datos: { precioReal: 12.5, contenidoComprado: null },
      }),
    ]);
    await waitFor(() => expect(screen.queryByText(/cambios? pendientes?/)).not.toBeInTheDocument());
  });

  it('corregir el precio sin conexión reemplaza al anterior en el mismo cambio pendiente', async () => {
    const { user, sincronizar } = montar(lista([item('a', 'Arroz')]));
    const arroz = await casilla('Arroz');
    enLinea = false;
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    await user.click(arroz);
    let form = await formulario('Arroz');
    await user.type(within(form).getByLabelText('Precio pagado (Q)'), '12.50');
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    await user.click(screen.getByRole('button', { name: 'Corregir precio de Arroz' }));
    form = await formulario('Arroz');
    const campo = within(form).getByLabelText('Precio pagado (Q)');
    expect(campo).toHaveValue('12.50');
    await user.clear(campo);
    await user.type(campo, '13');
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    expect(screen.getByText('1 cambio pendiente')).toBeInTheDocument();
    expect(screen.getByText('Pagado Q13.00')).toBeInTheDocument();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('corregir el precio con conexión envía un cambio de precio y cancelar lo deja igual', async () => {
    const comprado = item('a', 'Pechuga de pollo', {
      estado: 'COMPRADO',
      precioReal: '28.10',
      precioNormalizado: '28.10',
    });
    const { user, sincronizar } = montar(lista([comprado]));

    await user.click(
      await screen.findByRole('button', { name: 'Corregir precio de Pechuga de pollo' }),
    );
    let form = await formulario('Pechuga de pollo');
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(sincronizar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Corregir precio de Pechuga de pollo' }));
    form = await formulario('Pechuga de pollo');
    const campo = within(form).getByLabelText('Precio pagado (Q)');
    await user.clear(campo);
    await user.type(campo, '25');
    await user.click(within(form).getByRole('button', { name: 'Guardar precio' }));

    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    expect(cambiosEnviados(sincronizar)).toEqual([
      expect.objectContaining({ operacion: 'REGISTRAR_PRECIO', itemId: 'a' }),
    ]);
    expect(await screen.findByText('Pagado Q25.00')).toBeInTheDocument();
  });

  it('E4 desmarcar un producto comprado descarta su precio', async () => {
    const comprado = item('a', 'Pechuga de pollo', { estado: 'COMPRADO', precioReal: '28.10' });
    const { user } = montar(lista([comprado]));
    expect(await screen.findByText('Pagado Q28.10')).toBeInTheDocument();

    await user.click(await casilla('Pechuga de pollo'));

    await waitFor(() => expect(screen.queryByText(/^Pagado/)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /precio de Pechuga/ })).not.toBeInTheDocument();
  });

  it('"Ya lo tengo" no se cotiza: no ofrece precio y descarta el que había', async () => {
    const comprado = item('a', 'Tomate', { estado: 'COMPRADO', precioReal: '10.00' });
    const { user } = montar(lista([comprado]));
    await screen.findByText('Pagado Q10.00');

    await user.click(screen.getByRole('button', { name: 'Ya lo tengo Tomate' }));

    await waitFor(() => expect(screen.queryByText(/^Pagado/)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /precio de Tomate/ })).not.toBeInTheDocument();
  });

  it('un producto sin presentación (texto libre) no pide el contenido comprado', async () => {
    const { user } = montar(
      lista([item('t', 'Tortillas', { presentacion: null, origen: 'MANUAL' })]),
    );
    await user.click(await casilla('Tortillas'));
    const form = await formulario('Tortillas');
    expect(within(form).queryByLabelText(/Contenido comprado/)).not.toBeInTheDocument();
  });

  it('un menú histórico solo se consulta: sin precio que anotar', async () => {
    const comprado = item('a', 'Tomate', { estado: 'COMPRADO', precioReal: '10.00' });
    montar(lista([comprado]), { menu: menu({ estado: 'HISTORICO' }) });
    expect(await screen.findByText('Pagado Q10.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /precio de Tomate/ })).not.toBeInTheDocument();
  });
});
