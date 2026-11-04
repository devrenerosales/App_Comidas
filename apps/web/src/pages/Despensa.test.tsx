import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo, Producto } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiDespensa } from '../api/contexto-despensa';
import type { ApiDespensa, ProductoDespensa } from '../api/despensa';
import { ProblemaApi } from '../api/problema';
import Despensa from './Despensa';

const item = (extra: Partial<ProductoDespensa> = {}): ProductoDespensa => ({
  id: 'd1',
  producto: { id: 'p-arroz', nombre: 'Arroz', etiqueta: 'Arroz · bolsa 2 lb' },
  cantidad: '2.000',
  frecuencia: 'SEMANAL',
  ultimaInclusionSemana: '2026-10-18',
  proximaInclusion: '2026-10-25',
  tocaEstaSemana: true,
  notas: null,
  ...extra,
});

const producto = (id: string, nombre: string, etiqueta: string): Producto =>
  ({ id, nombre, etiqueta, activo: true }) as Producto;

function montar(
  opciones: {
    items?: ProductoDespensa[] | Error;
    productos?: Producto[];
    api?: Partial<ApiDespensa>;
  } = {},
) {
  const despensa = {
    listar: vi.fn().mockImplementation(() => {
      const i = opciones.items ?? [item()];
      return i instanceof Error ? Promise.reject(i) : Promise.resolve(i);
    }),
    agregar: vi.fn(),
    actualizar: vi.fn(),
    quitar: vi.fn().mockResolvedValue(undefined),
    ...opciones.api,
  };
  const catalogo = {
    listarProductos: vi.fn().mockResolvedValue({
      datos: opciones.productos ?? [],
      paginacion: { pagina: 1, tamano: 20, total: 0, totalPaginas: 1 },
    }),
  };
  render(
    <MemoryRouter>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiDespensa.Provider value={despensa as unknown as ApiDespensa}>
          <Despensa />
        </ContextoApiDespensa.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return { despensa, catalogo, user: userEvent.setup() };
}

const lista = () => screen.findByRole('list', { name: 'Productos de la despensa' });

describe('HU-29 Despensa', () => {
  it('muestra cada producto con su cantidad, frecuencia y si toca en la próxima lista', async () => {
    montar({
      items: [
        item(),
        item({
          id: 'd2',
          producto: { id: 'p-sal', nombre: 'Sal', etiqueta: 'Sal · bolsa 1 kg' },
          cantidad: '1.000',
          frecuencia: 'MENSUAL',
          ultimaInclusionSemana: '2026-10-04',
          proximaInclusion: '2026-11-01',
          tocaEstaSemana: false,
          notas: 'Gruesa',
        }),
      ],
    });
    const filas = within(await lista()).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent('Arroz');
    expect(filas[0]).toHaveTextContent('Cantidad: 2 · Semanal (cada semana)');
    expect(filas[0]).toHaveTextContent('Toca en la próxima lista');
    expect(filas[1]).toHaveTextContent('Cantidad: 1 · Mensual (cada 4 semanas)');
    expect(filas[1]).toHaveTextContent('Vuelve a tocar la semana del 01/11 al 07/11');
    expect(filas[1]).toHaveTextContent('Nota: Gruesa');
  });

  it('un producto sin fecha de próxima inclusión toca en la próxima lista', async () => {
    montar({ items: [item({ proximaInclusion: null, tocaEstaSemana: false })] });
    expect(within(await lista()).getByText('Toca en la próxima lista')).toBeVisible();
  });

  it('sin productos lo dice y deja agregar', async () => {
    montar({ items: [] });
    expect(await screen.findByText('Todavía no hay productos en la despensa.')).toBeVisible();
    expect(screen.getByRole('form', { name: 'Agregar a la despensa' })).toBeVisible();
  });

  it('CA-29.3 busca el producto, elige cantidad y frecuencia y lo agrega', async () => {
    const nuevo = item({
      id: 'd9',
      producto: { id: 'p-frijol', nombre: 'Frijol negro', etiqueta: 'Frijol negro · bolsa 1 lb' },
      cantidad: '2.000',
      proximaInclusion: null,
    });
    const agregar = vi.fn().mockResolvedValue(nuevo);
    const { user, despensa, catalogo } = montar({
      items: [],
      productos: [producto('p-frijol', 'Frijol negro', 'Frijol negro · bolsa 1 lb')],
      api: { agregar },
    });
    await screen.findByText('Todavía no hay productos en la despensa.');

    await user.type(screen.getByLabelText('Buscar producto'), 'frijol');
    await user.selectOptions(await screen.findByLabelText('Producto'), 'p-frijol');
    const cantidad = screen.getByLabelText('Cantidad (presentaciones)');
    await user.clear(cantidad);
    await user.type(cantidad, '2');
    await user.selectOptions(screen.getByLabelText('Frecuencia'), 'SEMANAL');
    await user.click(screen.getByRole('button', { name: 'Agregar a la despensa' }));

    await waitFor(() =>
      expect(agregar).toHaveBeenCalledWith({
        productoId: 'p-frijol',
        cantidad: '2',
        frecuencia: 'SEMANAL',
        notas: undefined,
      }),
    );
    expect(catalogo.listarProductos).toHaveBeenCalledWith({
      q: 'frijol',
      activo: 'true',
      tamano: 20,
    });
    expect(despensa.listar).toHaveBeenCalledTimes(1);
    const filas = within(await lista()).getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('Frijol negro');
    expect(screen.getByLabelText('Buscar producto')).toHaveValue('');
  });

  it('CA-29.4 una cantidad 0 muestra el mensaje y no se envía', async () => {
    const { user, despensa } = montar({
      items: [],
      productos: [producto('p-cafe', 'Café', 'Café · bolsa 400 g')],
    });
    await screen.findByText('Todavía no hay productos en la despensa.');
    await user.type(screen.getByLabelText('Buscar producto'), 'cafe');
    await user.selectOptions(await screen.findByLabelText('Producto'), 'p-cafe');
    const cantidad = screen.getByLabelText('Cantidad (presentaciones)');
    await user.clear(cantidad);
    await user.type(cantidad, '0');
    await user.click(screen.getByRole('button', { name: 'Agregar a la despensa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La cantidad debe ser mayor que 0');
    expect(despensa.agregar).not.toHaveBeenCalled();
  });

  it('agregar sin elegir un producto pide elegirlo', async () => {
    const { user, despensa } = montar({ items: [] });
    await screen.findByText('Todavía no hay productos en la despensa.');
    await user.click(screen.getByRole('button', { name: 'Agregar a la despensa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elige un producto del catálogo');
    expect(despensa.agregar).not.toHaveBeenCalled();
  });

  it('no ofrece los productos que ya están en la despensa', async () => {
    const { user } = montar({
      productos: [
        producto('p-arroz', 'Arroz', 'Arroz · bolsa 2 lb'),
        producto('p-arroz2', 'Arroz integral', 'Arroz integral · bolsa 1 lb'),
      ],
    });
    await lista();
    await user.type(screen.getByLabelText('Buscar producto'), 'arroz');
    const opciones = within(await screen.findByLabelText('Producto')).getAllByRole('option');
    expect(opciones.map((o) => o.textContent)).toEqual([
      'Elige un producto',
      'Arroz integral · bolsa 1 lb',
    ]);
  });

  it('un error del servidor al agregar se muestra', async () => {
    const agregar = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 409,
        codigo: 'YA_EN_DESPENSA',
        detail: 'Este producto ya está en la despensa',
      }),
    );
    const { user } = montar({
      items: [],
      productos: [producto('p-arroz', 'Arroz', 'Arroz · bolsa 2 lb')],
      api: { agregar },
    });
    await screen.findByText('Todavía no hay productos en la despensa.');
    await user.type(screen.getByLabelText('Buscar producto'), 'arroz');
    await user.selectOptions(await screen.findByLabelText('Producto'), 'p-arroz');
    await user.click(screen.getByRole('button', { name: 'Agregar a la despensa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este producto ya está en la despensa',
    );
  });

  it('edita cantidad, frecuencia y nota de un producto', async () => {
    const actualizado = item({
      cantidad: '3.000',
      frecuencia: 'QUINCENAL',
      notas: 'Grande',
      tocaEstaSemana: false,
      proximaInclusion: '2026-11-01',
    });
    const actualizar = vi.fn().mockResolvedValue(actualizado);
    const { user } = montar({ api: { actualizar } });
    await lista();

    await user.click(screen.getByRole('button', { name: 'Editar Arroz' }));
    const formulario = screen.getByRole('form', { name: 'Editar Arroz' });
    const cantidad = within(formulario).getByLabelText('Cantidad (presentaciones)');
    expect(cantidad).toHaveValue('2');
    await user.clear(cantidad);
    await user.type(cantidad, '3');
    await user.selectOptions(within(formulario).getByLabelText('Frecuencia'), 'QUINCENAL');
    await user.type(within(formulario).getByLabelText('Nota (opcional)'), 'Grande');
    await user.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(actualizar).toHaveBeenCalledWith('d1', {
        cantidad: '3',
        frecuencia: 'QUINCENAL',
        notas: 'Grande',
      }),
    );
    expect(await screen.findByText('Nota: Grande')).toBeVisible();
    expect(screen.queryByRole('form', { name: 'Editar Arroz' })).not.toBeInTheDocument();
    expect(within(await lista()).getByText(/Quincenal \(cada 2 semanas\)/)).toBeVisible();
  });

  it('una cantidad inválida al editar muestra el mensaje y un error del servidor también', async () => {
    const actualizar = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 404,
        codigo: 'NO_ENCONTRADO',
        detail: 'El producto no está en la despensa.',
      }),
    );
    const { user } = montar({ api: { actualizar } });
    await lista();
    await user.click(screen.getByRole('button', { name: 'Editar Arroz' }));
    const formulario = screen.getByRole('form', { name: 'Editar Arroz' });
    const cantidad = within(formulario).getByLabelText('Cantidad (presentaciones)');
    await user.clear(cantidad);
    await user.type(cantidad, '0');
    await user.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(formulario).findByRole('alert')).toHaveTextContent(
      'La cantidad debe ser mayor que 0',
    );
    expect(actualizar).not.toHaveBeenCalled();

    await user.clear(cantidad);
    await user.type(cantidad, '2');
    await user.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));
    expect(await within(formulario).findByRole('alert')).toHaveTextContent(
      'El producto no está en la despensa.',
    );
  });

  it('cancelar la edición cierra el formulario sin guardar', async () => {
    const { user, despensa } = montar();
    await lista();
    await user.click(screen.getByRole('button', { name: 'Editar Arroz' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Editar Arroz' })).not.toBeInTheDocument();
    expect(despensa.actualizar).not.toHaveBeenCalled();
  });

  it('quitar un producto lo saca de la despensa', async () => {
    const { user, despensa } = montar();
    await lista();
    await user.click(screen.getByRole('button', { name: 'Quitar Arroz de la despensa' }));
    await waitFor(() => expect(despensa.quitar).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText('Todavía no hay productos en la despensa.')).toBeVisible();
  });

  it('si quitar falla muestra el error', async () => {
    const quitar = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló el servidor' }),
      );
    const { user } = montar({ api: { quitar } });
    await lista();
    await user.click(screen.getByRole('button', { name: 'Quitar Arroz de la despensa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor');
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    const { user, despensa } = montar({
      items: new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló el servidor' }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló el servidor');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(despensa.listar).toHaveBeenCalledTimes(2));
  });

  it('un fallo al buscar productos se muestra', async () => {
    const { user, catalogo } = montar({ items: [] });
    catalogo.listarProductos.mockRejectedValue(
      new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló la búsqueda' }),
    );
    await screen.findByText('Todavía no hay productos en la despensa.');
    await user.type(screen.getByLabelText('Buscar producto'), 'arroz');
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la búsqueda');
  });

  it('ofrece volver a la lista de compras', async () => {
    montar();
    await lista();
    expect(screen.getByRole('link', { name: 'Volver a la lista de compras' })).toHaveAttribute(
      'href',
      '/lista',
    );
  });
});
