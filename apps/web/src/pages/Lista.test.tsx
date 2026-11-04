import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiListas } from '../api/contexto-listas';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiListas, ItemLista, ListaCompras } from '../api/listas';
import type { ApiMenus, MenuGenerado } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import Lista from './Lista';

const item = (extra: Partial<ItemLista> = {}): ItemLista => ({
  id: 'i1',
  producto: { id: 'pollo', nombre: 'Pollo en piezas' },
  cantidadRequerida: { cantidad: '6.75', unidad: 'lb' },
  equivalente: null,
  cantidadComprar: '7',
  presentacion: { cantidad: '1', unidad: 'lb', unidadCompra: 'lb', texto: 'lb 1 lb' },
  origen: 'MENU',
  estado: 'PENDIENTE',
  sinConversion: false,
  comidas: ['d1', 'd2'],
  ...extra,
});

const lista = (items: ItemLista[], extra: Partial<ListaCompras> = {}): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-11-01', hasta: '2026-11-07' },
  version: 1,
  excede: null,
  total: items.length,
  comprados: 0,
  sinConversion: items.filter((i) => i.sinConversion).length,
  items,
  ...extra,
});

const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado =>
  ({
    id: 'm1',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-07',
    estado: 'APROBADO',
    listaId: 'l1',
    ...extra,
  }) as MenuGenerado;

function montar(opciones: { menu?: MenuGenerado | Error; lista?: ListaCompras | Error }) {
  const menus = {
    obtenerPorSemana: vi.fn().mockImplementation(() => {
      const m = opciones.menu ?? menu();
      return m instanceof Error ? Promise.reject(m) : Promise.resolve(m);
    }),
  };
  const listas = {
    obtener: vi.fn().mockImplementation(() => {
      const l = opciones.lista ?? lista([item()]);
      return l instanceof Error ? Promise.reject(l) : Promise.resolve(l);
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
        <ContextoApiMenus.Provider value={menus as unknown as ApiMenus}>
          <ContextoApiListas.Provider value={listas as unknown as ApiListas}>
            <Lista />
          </ContextoApiListas.Provider>
        </ContextoApiMenus.Provider>
      </ContextoApiConfiguracion.Provider>
    </MemoryRouter>,
  );
  return { menus, listas, configuracion, user: userEvent.setup() };
}

const productos = () => screen.findByRole('list', { name: 'Productos de la lista' });

describe('HU-28 Lista de compras', () => {
  it('CA-28.1 muestra el producto sumado: 6.75 lb requeridas y 7 lb a comprar', async () => {
    const { menus, listas } = montar({});
    const filas = within(await productos()).getAllByRole('listitem');
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveTextContent('Pollo en piezas');
    expect(filas[0]).toHaveTextContent('Comprar: 7 lb');
    expect(filas[0]).toHaveTextContent('Requerido: 6.75 lb');
    expect(menus.obtenerPorSemana).toHaveBeenCalledWith('2026-10-25');
    expect(listas.obtener).toHaveBeenCalledWith('l1');
    expect(screen.getByRole('heading', { name: 'Lista del 01/11 al 07/11' })).toBeInTheDocument();
    expect(screen.getByText('0 / 1 comprados')).toBeInTheDocument();
  });

  it('CA-28.2 muestra el equivalente en la unidad de compra y presentaciones con contenido', async () => {
    montar({
      lista: lista([
        item({
          producto: { id: 't', nombre: 'Tomate' },
          cantidadRequerida: { cantidad: '800', unidad: 'g' },
          equivalente: { cantidad: '1.76', unidad: 'lb' },
          cantidadComprar: '2',
        }),
        item({
          id: 'i2',
          producto: { id: 'a', nombre: 'Arroz' },
          cantidadRequerida: { cantidad: '3', unidad: 'lb' },
          cantidadComprar: '2',
          presentacion: { cantidad: '2', unidad: 'lb', unidadCompra: 'bolsa', texto: 'bolsa 2 lb' },
        }),
      ]),
    });
    const [tomate, arroz] = within(await productos()).getAllByRole('listitem');
    expect(tomate).toHaveTextContent('Requerido: 800 g (≈ 1.76 lb)');
    expect(tomate).toHaveTextContent('Comprar: 2 lb');
    expect(arroz).toHaveTextContent('Comprar: 2 × bolsa 2 lb');
  });

  it('CA-28.3 un ítem sin conversión lleva la marca y el aviso general', async () => {
    montar({
      lista: lista([
        item({
          producto: { id: 'o', nombre: 'Orégano' },
          cantidadRequerida: { cantidad: '1', unidad: 'cucharadita' },
          cantidadComprar: '1',
          sinConversion: true,
          presentacion: { cantidad: '10', unidad: 'g', unidadCompra: 'sobre', texto: 'sobre 10 g' },
        }),
        item({ id: 'i2' }),
      ]),
    });
    const [oregano, otro] = within(await productos()).getAllByRole('listitem');
    expect(oregano).toHaveTextContent('Requerido: 1 cucharadita');
    expect(oregano).toHaveTextContent('Sin conversión');
    expect(otro).not.toHaveTextContent('Sin conversión');
    expect(screen.getByText(/Hay productos sin conversión de unidades/)).toBeInTheDocument();
  });

  it('un producto sin cantidad requerida ni presentación muestra solo lo que hay que comprar', async () => {
    montar({
      lista: lista([
        item({
          cantidadRequerida: null,
          presentacion: null,
          cantidadComprar: '1',
          sinConversion: true,
        }),
      ]),
    });
    const [fila] = within(await productos()).getAllByRole('listitem');
    expect(fila).toHaveTextContent('Comprar: 1');
    expect(fila).not.toHaveTextContent('Requerido');
  });

  it('CA-28.4 un menú en Borrador pide aprobarlo y no pide la lista', async () => {
    const { listas } = montar({ menu: menu({ estado: 'BORRADOR', listaId: null }) });
    expect(await screen.findByText(/Aprueba el menú para generar la lista/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a Semana' })).toHaveAttribute('href', '/semana');
    expect(listas.obtener).not.toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: 'Productos de la lista' })).not.toBeInTheDocument();
  });

  it('una semana sin menú lo dice y ofrece ir a Semana', async () => {
    const { listas } = montar({
      menu: new ProblemaApi({ status: 404, codigo: 'SIN_MENU', detail: 'Sin menú' }),
    });
    expect(await screen.findByText(/Esta semana todavía no tiene menú/)).toBeInTheDocument();
    expect(listas.obtener).not.toHaveBeenCalled();
  });

  it('CA-28.6 el encabezado muestra en rojo el exceso con que se aprobó', async () => {
    montar({ lista: lista([item()], { excede: { monto: '17.00', texto: 'Excede por Q17.00' } }) });
    expect(await screen.findByText('Excede por Q17.00')).toHaveClass('mf-exceso');
    expect(await productos()).toBeInTheDocument();
  });

  it('con los ítems cubiertos cuenta cuántos van', async () => {
    montar({ lista: lista([item(), item({ id: 'i2', estado: 'COMPRADO' })], { comprados: 1 }) });
    expect(await screen.findByText('1 / 2 comprados')).toBeInTheDocument();
  });

  it('una lista sin productos explica que los platillos no tienen ingredientes', async () => {
    montar({ lista: lista([]) });
    expect(await screen.findByText(/todavía no tienen ingredientes/)).toBeInTheDocument();
  });

  it('ofrece las semanas ya aprobadas y las próximas, y abre la más reciente que ya pasó', async () => {
    montar({});
    await productos();
    const opciones = within(screen.getByLabelText('Semana')).getAllByRole('option');
    expect(opciones).toHaveLength(12);
    expect(opciones[0]).toHaveValue('2026-09-06');
    expect(opciones[8]).toHaveValue('2026-11-01');
    expect(opciones[11]).toHaveValue('2026-11-22');
    expect(screen.getByLabelText('Semana')).toHaveValue('2026-10-25');
  });

  it('cambiar de semana abre el menú de esa semana', async () => {
    const { menus, user } = montar({});
    await productos();
    await user.selectOptions(screen.getByLabelText('Semana'), '2026-11-08');
    await waitFor(() => expect(menus.obtenerPorSemana).toHaveBeenLastCalledWith('2026-11-08'));
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    const { menus, user } = montar({
      menu: new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló el servidor' }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(menus.obtenerPorSemana).toHaveBeenCalledTimes(2));
  });
});

describe('HU-27 Gasto real desde la lista', () => {
  it('ofrece registrar el gasto con la suma de los precios anotados como sugerencia', async () => {
    const { menus, user } = montar({ lista: lista([item()], { gastoSugerido: '73.60' }) });
    const registrarGasto = vi.fn().mockResolvedValue({
      gastoReal: '73.60',
      nota: null,
      diferenciaVsEstimado: null,
      diferenciaVsPresupuesto: null,
      registradoPor: null,
      registradoEn: null,
    });
    Object.assign(menus, { registrarGasto });
    await productos();

    await user.click(await screen.findByRole('button', { name: 'Registrar gasto real' }));
    expect(screen.getByLabelText('Monto gastado (Q)')).toHaveValue('73.60');
    await user.click(screen.getByRole('button', { name: 'Guardar gasto' }));

    await waitFor(() => expect(registrarGasto).toHaveBeenCalledWith('m1', '73.60', undefined));
    expect(await screen.findByRole('button', { name: 'Corregir gasto' })).toBeVisible();
  });

  it('un menú sin aprobar no ofrece el gasto', async () => {
    montar({ menu: menu({ estado: 'BORRADOR', listaId: null }) });
    await screen.findByText(/Aprueba el menú para generar la lista/);
    expect(screen.queryByRole('button', { name: 'Registrar gasto real' })).not.toBeInTheDocument();
  });
});

describe('HU-29 Despensa desde la lista', () => {
  it('CA-29.1 y CA-29.2 avisa el origen despensa de los productos que la traen', async () => {
    montar({
      lista: lista([
        item({ id: 'i1', origen: 'MENU' }),
        item({
          id: 'i2',
          producto: { id: 'arroz', nombre: 'Arroz' },
          origen: 'DESPENSA',
          cantidadRequerida: null,
        }),
        item({ id: 'i3', producto: { id: 'aceite', nombre: 'Aceite' }, origen: 'MENU_Y_DESPENSA' }),
      ]),
    });
    const filas = within(await productos()).getAllByRole('listitem');
    expect(filas[0]).not.toHaveTextContent('Despensa');
    expect(filas[1]).toHaveTextContent('Arroz');
    expect(filas[1]).toHaveTextContent('Despensa');
    expect(filas[2]).toHaveTextContent('Menú + Despensa');
  });

  it('ofrece configurar la despensa', async () => {
    montar({});
    await productos();
    expect(screen.getByRole('link', { name: 'Configurar la despensa' })).toHaveAttribute(
      'href',
      '/despensa',
    );
  });
});
