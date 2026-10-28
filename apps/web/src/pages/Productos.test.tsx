import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import { CATEGORIAS, CREMA, LB, apiCatalogoFalsa, pagina, producto } from '../test/catalogo-datos';
import { renderizarCatalogo } from '../test/catalogo';

const ARROZ = producto('Arroz', LB, {
  tipo: 'DESPENSA',
  categoria: { id: 'c-granos', codigo: 'granos', nombre: 'Granos' },
  unidadCompra: 'bolsa',
  presentacion: { cantidad: '2.000', unidad: LB },
  etiqueta: 'Arroz · bolsa 2 lb',
});

async function llenarProducto(nombre: string, unidadCompra: string, cantidad: string) {
  await userEvent.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
  const form = within(screen.getByRole('form', { name: 'Nuevo producto' }));
  await userEvent.type(form.getByLabelText('Nombre del producto'), nombre);
  await userEvent.selectOptions(form.getByLabelText('Tipo'), 'DESPENSA');
  await userEvent.selectOptions(form.getByLabelText('Categoría'), 'c-granos');
  await userEvent.type(form.getByLabelText(/Unidad de compra/), unidadCompra);
  const presentacion = form.getByLabelText('Presentación (cantidad)');
  await userEvent.clear(presentacion);
  await userEvent.type(presentacion, cantidad);
  await userEvent.click(form.getByRole('button', { name: 'Guardar producto' }));
  return form;
}

describe('Catálogo de productos (HU-13)', () => {
  it('CA-13.1 crea "Arroz" despensa, granos, bolsa 2 lb y filtra por tipo despensa', async () => {
    const api = apiCatalogoFalsa({ crearProducto: vi.fn().mockResolvedValue(ARROZ) });
    renderizarCatalogo('/platillos/productos', api);
    await llenarProducto('Arroz', 'bolsa', '2');
    expect(api.crearProducto).toHaveBeenCalledWith({
      nombre: 'Arroz',
      tipo: 'DESPENSA',
      categoriaId: 'c-granos',
      unidadCompra: 'bolsa',
      presentacionCantidad: '2',
      presentacionUnidadId: LB.id,
    });
    expect(await screen.findByText('Guardado: Arroz · bolsa 2 lb')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'DESPENSA');
    await waitFor(() =>
      expect(api.listarProductos).toHaveBeenLastCalledWith(
        expect.objectContaining({ tipo: 'DESPENSA', activo: 'true' }),
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), CATEGORIAS[2]!.codigo);
    await waitFor(() =>
      expect(api.listarProductos).toHaveBeenLastCalledWith(
        expect.objectContaining({ categoria: 'granos' }),
      ),
    );
  });

  it('CA-13.3 duplicado: no guarda y ofrece abrir "Aceite · botella 900 ml"', async () => {
    const api = apiCatalogoFalsa({
      crearProducto: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'PRODUCTO_DUPLICADO',
          detail: 'Ya existe Aceite · botella 900 ml',
          existenteId: 'p-aceite',
          existente: 'Aceite · botella 900 ml',
        }),
      ),
    });
    renderizarCatalogo('/platillos/productos', api);
    await llenarProducto('aceite', 'botella', '900');
    expect(await screen.findByText('Ya existe Aceite · botella 900 ml')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar Aceite · botella 900 ml' }));
    expect(screen.queryByRole('form', { name: 'Nuevo producto' })).not.toBeInTheDocument();
  });

  it('CA-13.4 presentación 0 lb: "La presentación debe ser mayor que 0"', async () => {
    const { api } = renderizarCatalogo('/platillos/productos');
    const form = await llenarProducto('Frijol negro', 'bolsa', '0');
    expect(form.getByText('La presentación debe ser mayor que 0')).toBeInTheDocument();
    expect(api.crearProducto).not.toHaveBeenCalled();
    await userEvent.clear(form.getByLabelText('Nombre del producto'));
    await userEvent.clear(form.getByLabelText(/Unidad de compra/));
    await userEvent.click(form.getByRole('button', { name: 'Guardar producto' }));
    expect(form.getByText('Ingresa el nombre del producto')).toBeInTheDocument();
    expect(
      form.getByText(/Indica cómo se compra/, { selector: '.mf-campo__error' }),
    ).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form', { name: 'Nuevo producto' })).not.toBeInTheDocument();
  });

  it('errores de campo y generales de la API al crear', async () => {
    const api = apiCatalogoFalsa({
      crearProducto: vi
        .fn()
        .mockRejectedValueOnce(
          new ProblemaApi({
            status: 422,
            codigo: 'NOMBRE_LARGO',
            detail: 'x',
            errores: [{ campo: 'nombre', mensaje: 'El nombre admite hasta 80 caracteres' }],
          }),
        )
        .mockRejectedValueOnce(new ProblemaApi({ status: 500, detail: 'Sin servicio' })),
    });
    renderizarCatalogo('/platillos/productos', api);
    const form = await llenarProducto('Arroz', 'bolsa', '2');
    expect(await form.findByText('El nombre admite hasta 80 caracteres')).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Guardar producto' }));
    expect(await form.findByText('Sin servicio')).toBeInTheDocument();
  });

  it('CA-13.2 el administrador del sistema inactiva "Crema" y ve los platillos afectados', async () => {
    const api = apiCatalogoFalsa({
      inactivarProducto: vi.fn().mockResolvedValue({
        producto: { ...CREMA, activo: false },
        platillosAfectados: [{ id: 'pl1', nombre: 'Pollo en crema' }],
      }),
      listarProductos: vi
        .fn()
        .mockResolvedValueOnce(pagina([CREMA]))
        .mockResolvedValueOnce(pagina([]))
        .mockResolvedValue(pagina([{ ...CREMA, activo: false }])),
    });
    renderizarCatalogo('/platillos/productos', api, { esAdminSistema: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Inactivar Crema' }));
    expect(
      await screen.findByText(/Crema inactivado. Lo usan: Pollo en crema/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Ver inactivos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivar Crema' }));
    expect(await screen.findByText('Crema reactivado.')).toBeInTheDocument();
    expect(api.reactivarProducto).toHaveBeenCalledWith(CREMA.id);
  });

  it('un miembro no ve inactivar; error al inactivar se muestra', async () => {
    renderizarCatalogo('/platillos/productos');
    expect(await screen.findByText('Crema · bolsa 500 ml')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inactivar Crema' })).not.toBeInTheDocument();
  });

  it('error al inactivar y sin coincidencias', async () => {
    const api = apiCatalogoFalsa({
      inactivarProducto: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 403, detail: 'Solo el administrador del sistema' }),
        ),
      listarProductos: vi
        .fn()
        .mockResolvedValueOnce(pagina([CREMA]))
        .mockResolvedValue(pagina([])),
    });
    renderizarCatalogo('/platillos/productos', api, { esAdminSistema: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Inactivar Crema' }));
    expect(await screen.findByText('Solo el administrador del sistema')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Buscar producto'), 'zzz');
    expect(await screen.findByText('Sin coincidencias')).toBeInTheDocument();
  });
});
