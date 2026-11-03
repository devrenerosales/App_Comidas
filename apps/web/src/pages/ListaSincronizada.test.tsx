import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiConfiguracion } from '../api/configuracion';
import { ContextoApiConfiguracion } from '../api/contexto-configuracion';
import { ContextoApiListas } from '../api/contexto-listas';
import { ContextoApiMenus } from '../api/contexto-menus';
import type { ApiListas, ItemLista, ListaCompras, RespuestaSync } from '../api/listas';
import type { ApiMenus, MenuGenerado } from '../api/menus';
import { ProblemaApi } from '../api/problema';
import type { CambioLista } from '@menu/shared';
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

const NOMBRES = [
  'Pollo en piezas',
  'Tomate',
  'Cebolla',
  'Arroz',
  'Frijol',
  'Azúcar',
  'Sal',
  'Aceite',
  'Papa',
  'Zanahoria',
  'Huevos',
  'Crema',
];

const item = (id: string, nombre: string, extra: Partial<ItemLista> = {}): ItemLista => ({
  id,
  producto: { id: `p-${id}`, nombre },
  cantidadRequerida: null,
  equivalente: null,
  cantidadComprar: '7',
  presentacion: { cantidad: '1', unidad: 'lb', unidadCompra: 'lb', texto: 'lb 1 lb' },
  origen: 'MENU',
  estado: 'PENDIENTE',
  sinConversion: false,
  comidas: [],
  ...extra,
});

const lista = (items: ItemLista[], version = 1): ListaCompras => ({
  id: 'l1',
  menuId: 'm1',
  semana: { desde: '2026-11-01', hasta: '2026-11-07' },
  version,
  excede: null,
  total: items.length,
  comprados: items.filter((i) => i.estado !== 'PENDIENTE').length,
  sinConversion: 0,
  items,
});

const DOCE = NOMBRES.map((n, i) => item(`i${i + 1}`, n));

const menu = (extra: Partial<MenuGenerado> = {}): MenuGenerado =>
  ({
    id: 'm1',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-07',
    estado: 'APROBADO',
    listaId: 'l1',
    ...extra,
  }) as MenuGenerado;

/** Respuesta del servidor a un lote: aplica todo y devuelve `despues` como lista vigente. */
const respuesta = (
  ids: string[],
  despues: ListaCompras,
  resultado: 'APLICADO' | 'RECHAZADO' = 'APLICADO',
): RespuestaSync => ({
  version: despues.version,
  resultados: ids.map((id) => ({ id, resultado })),
  lista: despues,
});

interface Opciones {
  menu?: MenuGenerado;
  servidor?: ListaCompras;
  sincronizar?: ReturnType<typeof vi.fn>;
}

function montar(opciones: Opciones = {}) {
  const servidor = opciones.servidor ?? lista(DOCE);
  // Servidor simulado: aplica los cambios que recibe y devuelve la lista vigente.
  let vigente = servidor;
  const sincronizar =
    opciones.sincronizar ??
    vi.fn().mockImplementation((_id: string, cambios: CambioLista[]) => {
      vigente = cambios.reduce(aplicarCambioLocal, vigente);
      vigente = { ...vigente, version: vigente.version + 1 };
      return Promise.resolve(
        respuesta(
          cambios.map((c) => c.id),
          vigente,
        ),
      );
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
  return { menus, listas, sincronizar, user: userEvent.setup() };
}

/** Modo avión con la lista ya descargada (CU-07.3: se descarga al menos una vez con conexión). */
async function desconectar() {
  enLinea = false;
  await act(async () => {
    window.dispatchEvent(new Event('offline'));
  });
}

const casilla = (nombre: string) =>
  screen.findByRole('checkbox', { name: `Marcar ${nombre} como comprado` });
const productos = () => screen.findByRole('list', { name: 'Productos de la lista' });
const estado = () => screen.queryByText(/cambios? pendientes?/);

describe('HU-30 Editar y marcar la lista', () => {
  it('CA-30.1 marcar un producto lo tacha, cuenta "1 / 12 comprados" y lo guarda en el servidor', async () => {
    const despues = lista(
      DOCE.map((i) => (i.id === 'i1' ? { ...i, estado: 'COMPRADO' as const } : i)),
      2,
    );
    const sincronizar = vi.fn().mockImplementation((_l: string, c: { id: string }[]) =>
      Promise.resolve(
        respuesta(
          c.map((x) => x.id),
          despues,
        ),
      ),
    );
    const { user } = montar({ sincronizar });
    expect(await screen.findByText('0 / 12 comprados')).toBeInTheDocument();

    await user.click(await casilla('Pollo en piezas'));

    expect(await screen.findByText('1 / 12 comprados')).toBeInTheDocument();
    expect(within(await productos()).getByText('Pollo en piezas')).toHaveClass('mf-tachado');
    expect(within(await productos()).getByText('Tomate')).not.toHaveClass('mf-tachado');
    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    const [listaId, cambios, versionBase] = sincronizar.mock.calls[0]!;
    expect(listaId).toBe('l1');
    expect(versionBase).toBe(1);
    expect(cambios).toEqual([
      expect.objectContaining({ itemId: 'i1', operacion: 'MARCAR_COMPRADO' }),
    ]);
    expect(Date.parse(cambios[0].marcaTiempo)).not.toBeNaN();
    await waitFor(() => expect(estado()).not.toBeInTheDocument());
  });

  it('desmarcar vuelve a pendiente y "Ya lo tengo" cuenta como cubierto', async () => {
    const { user } = montar();
    await user.click(await casilla('Tomate'));
    await user.click(await casilla('Tomate'));
    await waitFor(() => expect(screen.getByText('0 / 12 comprados')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ya lo tengo Cebolla' }));

    expect(await screen.findByText('1 / 12 comprados')).toBeInTheDocument();
    const cebolla = screen.getByRole('button', { name: 'Ya lo tengo Cebolla' });
    expect(cebolla).toHaveAttribute('aria-pressed', 'true');
  });

  it('quitar un producto lo saca de la lista y envía la baja', async () => {
    const { user, sincronizar } = montar();
    await productos();

    await user.click(screen.getByRole('button', { name: 'Quitar Azúcar' }));

    expect(await screen.findByText('0 / 11 comprados')).toBeInTheDocument();
    expect(within(await productos()).queryByText('Azúcar')).not.toBeInTheDocument();
    await waitFor(() => expect(sincronizar).toHaveBeenCalled());
    expect(sincronizar.mock.calls[0]![1]).toEqual([
      expect.objectContaining({ itemId: 'i6', operacion: 'ELIMINAR' }),
    ]);
  });

  it('CA-30.2 sin conexión acumula 4 cambios pendientes y los envía solos al reconectar', async () => {
    const { user, sincronizar } = montar();
    await productos();
    await desconectar();
    expect(
      screen.getByText(/Sin conexión: los cambios se guardan en este teléfono/),
    ).toBeInTheDocument();

    await user.click(await casilla('Pollo en piezas'));
    await user.click(await casilla('Tomate'));
    await user.click(await casilla('Cebolla'));
    await user.type(screen.getByLabelText('Producto'), 'Tortillas');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '30');
    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('4 cambios pendientes')).toBeInTheDocument();
    expect(screen.getByText('3 / 13 comprados')).toBeInTheDocument();
    const tortillas = within(await productos())
      .getByText('Tortillas')
      .closest('li')!;
    expect(tortillas).toHaveTextContent('Comprar: 30');
    expect(sincronizar).not.toHaveBeenCalled();

    // Al desactivar el modo avión los cambios se envían sin acción del usuario.
    enLinea = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    const cambios = sincronizar.mock.calls[0]![1] as { operacion: string }[];
    expect(cambios.map((c) => c.operacion)).toEqual([
      'MARCAR_COMPRADO',
      'MARCAR_COMPRADO',
      'MARCAR_COMPRADO',
      'AGREGAR',
    ]);
    await waitFor(() => expect(estado()).not.toBeInTheDocument());
    expect(screen.queryByText(/Sin conexión:/)).not.toBeInTheDocument();
  });

  it('un cambio sin conexión queda en singular y se conserva al volver a abrir la lista', async () => {
    const primera = montar();
    const sal = await casilla('Sal');
    await desconectar();
    await primera.user.click(sal);
    expect(await screen.findByText('1 cambio pendiente')).toBeInTheDocument();
  });

  it('con la copia local abre la lista sin conexión, con sus cambios pendientes', async () => {
    enLinea = false;
    const local = lista(DOCE);
    almacen.set(
      'mf.lista.l1',
      JSON.stringify({
        base: local,
        cola: [
          {
            id: 'c1',
            itemId: 'i7',
            operacion: 'MARCAR_COMPRADO',
            marcaTiempo: '2026-11-03T10:00:00.000Z',
          },
        ],
      }),
    );
    const { listas } = montar();

    expect(await screen.findByText('1 / 12 comprados')).toBeInTheDocument();
    expect(screen.getByText('1 cambio pendiente')).toBeInTheDocument();
    expect(listas.obtener).not.toHaveBeenCalled();
  });

  it('con conexión y cambios guardados de antes los envía al abrir', async () => {
    almacen.set(
      'mf.lista.l1',
      JSON.stringify({
        base: lista(DOCE),
        cola: [
          {
            id: 'c1',
            itemId: 'i7',
            operacion: 'MARCAR_COMPRADO',
            marcaTiempo: '2026-11-03T10:00:00.000Z',
          },
        ],
      }),
    );
    const { sincronizar } = montar();

    await waitFor(() => expect(sincronizar).toHaveBeenCalledTimes(1));
    expect(sincronizar.mock.calls[0]![1]).toEqual([expect.objectContaining({ id: 'c1' })]);
  });

  it('si falla la red conserva la cola y avisa que no hay conexión', async () => {
    const sincronizar = vi.fn().mockRejectedValue(ProblemaApi.sinConexion());
    const { user } = montar({ sincronizar });

    await user.click(await casilla('Tomate'));

    expect(await screen.findByText('1 cambio pendiente')).toBeInTheDocument();
    expect(await screen.findByText(/Sin conexión:/)).toBeInTheDocument();
    expect(screen.getByText('1 / 12 comprados')).toBeInTheDocument();
  });

  it('un error del servidor tampoco descarta la cola', async () => {
    const sincronizar = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 503, codigo: 'NO_DISPONIBLE', detail: 'Caído' }),
      );
    const { user } = montar({ sincronizar });

    await user.click(await casilla('Tomate'));

    expect(await screen.findByText('1 cambio pendiente')).toBeInTheDocument();
  });

  it('CU-07.3 E2 un cambio rechazado por el servidor se descarta y se avisa', async () => {
    const sincronizar = vi.fn().mockImplementation((_l: string, c: { id: string }[]) =>
      Promise.resolve(
        respuesta(
          c.map((x) => x.id),
          lista(DOCE, 2),
          'RECHAZADO',
        ),
      ),
    );
    const { user } = montar({ sincronizar });

    await user.click(await casilla('Tomate'));

    expect(
      await screen.findByText('Un cambio no se pudo aplicar y se descartó.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(estado()).not.toBeInTheDocument());
    expect(screen.getByText('0 / 12 comprados')).toBeInTheDocument();
  });

  it('varios cambios rechazados se cuentan en el aviso', async () => {
    const sincronizar = vi.fn().mockImplementation((_l: string, c: { id: string }[]) =>
      Promise.resolve(
        respuesta(
          c.map((x) => x.id),
          lista(DOCE, 2),
          'RECHAZADO',
        ),
      ),
    );
    const { user } = montar({ sincronizar });
    await productos();
    await desconectar();
    await user.click(await casilla('Tomate'));
    await user.click(await casilla('Sal'));

    enLinea = true;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(
      await screen.findByText('2 cambios no se pudieron aplicar y se descartaron.'),
    ).toBeInTheDocument();
  });

  it('si el servidor rechaza el lote completo (la lista ya no existe) lo descarta y muestra el motivo', async () => {
    const sincronizar = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'La lista no existe.' }),
      );
    const { user } = montar({ sincronizar });

    await user.click(await casilla('Tomate'));

    expect(await screen.findByText('La lista no existe.')).toBeInTheDocument();
    await waitFor(() => expect(estado()).not.toBeInTheDocument());
  });

  it('CA-30.4 agregar con cantidad 0 muestra el error y no agrega el producto', async () => {
    const { user, sincronizar } = montar();
    await productos();
    await user.type(screen.getByLabelText('Producto'), 'Cebolla morada');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '0');

    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0');
    expect(within(await productos()).queryByText('Cebolla morada')).not.toBeInTheDocument();
    expect(screen.getByText('0 / 12 comprados')).toBeInTheDocument();
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('agregar sin nombre pide el nombre del producto', async () => {
    const { user } = montar();
    await productos();
    await user.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del producto');
  });

  it('un producto agregado bien limpia el formulario', async () => {
    const { user } = montar();
    await productos();
    await user.type(screen.getByLabelText('Producto'), 'Tortillas');
    await user.clear(screen.getByLabelText('Cantidad'));
    await user.type(screen.getByLabelText('Cantidad'), '30');

    await user.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('0 / 13 comprados')).toBeInTheDocument();
    expect(screen.getByLabelText('Producto')).toHaveValue('');
    expect(screen.getByLabelText('Cantidad')).toHaveValue('1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('un menú que no está aprobado (histórico) solo se consulta: sin casillas ni formulario', async () => {
    montar({ menu: menu({ estado: 'HISTORICO' }) });
    await productos();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Agregar producto' })).not.toBeInTheDocument();
  });
});
