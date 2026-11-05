import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo, Producto, Unidad } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiVinculos } from '../api/contexto-vinculos';
import { ProblemaApi } from '../api/problema';
import type { ApiVinculos, SupermercadoCatalogo, Vinculo } from '../api/vinculos';
import VinculosProducto from './VinculosProducto';

const LB: Unidad = {
  id: 'u-lb',
  codigo: 'lb',
  nombre: 'libra',
  magnitud: 'MASA',
  factorBase: '453.59237',
};
const LITRO: Unidad = {
  id: 'u-l',
  codigo: 'l',
  nombre: 'litro',
  magnitud: 'VOLUMEN',
  factorBase: '1000',
};

const ARROZ: Producto = {
  id: 'p1',
  nombre: 'Arroz',
  tipo: 'AMBOS',
  categoria: { id: 'c1', codigo: 'granos', nombre: 'Granos' },
  unidadCompra: 'bolsa',
  presentacion: { cantidad: '2.000', unidad: LB },
  etiqueta: 'Arroz · bolsa 2 lb',
  activo: true,
} as Producto;

const WALMART: SupermercadoCatalogo = {
  id: 's1',
  nombre: 'Walmart',
  requiereEnlace: true,
  dominio: null,
};
const SUPER_FRESH: SupermercadoCatalogo = {
  id: 's2',
  nombre: 'Super Fresh',
  requiereEnlace: false,
  dominio: null,
};

const vinculo = (extra: Partial<Vinculo> = {}): Vinculo => ({
  id: 'v1',
  productoId: 'p1',
  supermercado: { id: 's1', nombre: 'Walmart' },
  nombreTienda: 'Arroz blanco 2 lb',
  marca: 'Gallo',
  presentacion: { cantidad: '2', unidad: 'lb', texto: '2 lb' },
  factor: '1',
  url: null,
  sku: 'WM-000123',
  activo: true,
  ultimoPrecio: null,
  ...extra,
});

function abrir(
  opciones: { vinculos?: Vinculo[]; producto?: Producto } = {},
  extra: Partial<Record<keyof ApiVinculos, unknown>> = {},
) {
  const api = {
    supermercados: vi.fn().mockResolvedValue([WALMART, SUPER_FRESH]),
    listar: vi.fn().mockResolvedValue(opciones.vinculos ?? []),
    crear: vi.fn().mockResolvedValue(vinculo()),
    actualizar: vi.fn().mockResolvedValue(vinculo()),
    ...extra,
  };
  const catalogo = {
    obtenerProducto: vi.fn().mockResolvedValue(opciones.producto ?? ARROZ),
    listarUnidades: vi.fn().mockResolvedValue([LB, LITRO]),
  };
  render(
    <MemoryRouter initialEntries={['/platillos/productos/p1/supermercados']}>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiVinculos.Provider value={api as unknown as ApiVinculos}>
          <Route path="/platillos/productos/:id/supermercados">
            <VinculosProducto />
          </Route>
        </ContextoApiVinculos.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return {
    api: api as typeof api & {
      crear: ReturnType<typeof vi.fn>;
      actualizar: ReturnType<typeof vi.fn>;
    },
    catalogo,
    user: userEvent.setup(),
  };
}

type Usuario = ReturnType<typeof userEvent.setup>;

/** Llena lo mínimo para vincular con Walmart: nombre, cantidad y SKU. */
async function llenar(user: Usuario, cantidad = '2') {
  await screen.findByRole('heading', { name: 'Vincular supermercado' });
  await user.type(screen.getByLabelText('Nombre en la tienda'), 'Arroz blanco 2 lb');
  await user.type(screen.getByLabelText('Cantidad de la presentación'), cantidad);
  await user.type(screen.getByLabelText('SKU'), 'WM-000123');
}

describe('HU-35 Vínculos de un producto', () => {
  it('muestra la presentación de compra y los vínculos con su último precio', async () => {
    abrir({
      vinculos: [
        vinculo({
          ultimoPrecio: {
            precio: '12.50',
            precioNormalizado: '12.50',
            fecha: '2026-10-20',
            origen: 'MANUAL',
          },
        }),
      ],
    });
    const lista = await screen.findByRole('region', { name: 'Vínculos' });
    expect(screen.getByText('Arroz · bolsa 2 lb')).toBeVisible();
    expect(within(lista).getByText('Walmart · Arroz blanco 2 lb')).toBeVisible();
    expect(
      within(lista).getByText(
        'Gallo · Presentación 2 lb · Factor 1 · SKU WM-000123 · Último precio: Q12.50 · 20/10/2026',
      ),
    ).toBeVisible();
  });

  it('sin vínculos lo indica', async () => {
    abrir();
    expect(
      await screen.findByText('Todavía no está vinculado con ningún supermercado.'),
    ).toBeVisible();
  });

  it('un vínculo reemplazado se marca y no se puede editar', async () => {
    abrir({ vinculos: [vinculo({ activo: false, ultimoPrecio: null })] });
    expect(await screen.findByText('Walmart · Arroz blanco 2 lb (reemplazado)')).toBeVisible();
    expect(screen.getByText(/Sin precio registrado/)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Editar vínculo/ })).not.toBeInTheDocument();
  });

  it('CA-35.1 vincula con la misma presentación y manda los datos', async () => {
    const { api, user } = abrir();
    await llenar(user);
    expect(screen.getByText(/equivale a 1 veces la tuya/)).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Vincular' }));

    expect(api.crear).toHaveBeenCalledWith(
      'p1',
      {
        supermercadoId: 's1',
        nombreTienda: 'Arroz blanco 2 lb',
        presentacionCantidad: '2',
        presentacionUnidadId: 'u-lb',
        sku: 'WM-000123',
      },
      false,
    );
    expect(await screen.findByText('Vínculo guardado.')).toBeVisible();
    expect(screen.getByLabelText('Nombre en la tienda')).toHaveValue('');
  });

  it('manda también la marca y la URL cuando se escriben', async () => {
    const { api, user } = abrir();
    await llenar(user, '2,5');
    await user.type(screen.getByLabelText('Marca (opcional)'), 'Gallo');
    await user.type(screen.getByLabelText('URL del producto'), 'https://www.walmart.com.gt/arroz');

    await user.click(screen.getByRole('button', { name: 'Vincular' }));

    expect(api.crear.mock.calls[0]![1]).toMatchObject({
      marca: 'Gallo',
      presentacionCantidad: '2.5',
      url: 'https://www.walmart.com.gt/arroz',
    });
  });

  it('CA-35.2 una bolsa de 5 lb contra la de 2 lb muestra el factor 2.5', async () => {
    const { user } = abrir();
    await llenar(user, '5');
    expect(screen.getByText(/equivale a 2\.5 veces la tuya/)).toBeVisible();
  });

  it('CA-35.4 una unidad de otra magnitud avisa y no deja vincular', async () => {
    const { api, user } = abrir();
    await llenar(user, '1');

    await user.selectOptions(screen.getByLabelText('Unidad'), 'u-l');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La unidad de la presentación no es convertible a libras',
    );
    expect(screen.getByRole('button', { name: 'Vincular' })).toBeDisabled();
    expect(api.crear).not.toHaveBeenCalled();
  });

  it('2a Super Fresh no pide URL ni SKU', async () => {
    const { user } = abrir();
    await screen.findByRole('heading', { name: 'Vincular supermercado' });

    await user.selectOptions(screen.getByLabelText('Supermercado'), 's2');

    expect(screen.queryByLabelText('SKU')).not.toBeInTheDocument();
    expect(screen.getByText(/Super Fresh no se consulta automáticamente/)).toBeVisible();
  });

  describe('CA-35.3 vínculo activo existente', () => {
    const conflicto = () =>
      new ProblemaApi({
        status: 409,
        codigo: 'VINCULO_ACTIVO_EXISTE',
        detail: 'Ya existe',
        vinculoExistente: vinculo(),
      } as never);

    it('ofrece reemplazar y, al confirmar, vuelve a enviar con reemplazar', async () => {
      const crear = vi.fn().mockRejectedValueOnce(conflicto()).mockResolvedValue(vinculo());
      const { api, user } = abrir({}, { crear });
      await llenar(user);
      await user.click(screen.getByRole('button', { name: 'Vincular' }));

      const dialogo = await screen.findByRole('alertdialog', { name: 'Reemplazar vínculo' });
      expect(dialogo).toHaveTextContent(
        'ya tiene un vínculo activo en Walmart (Arroz blanco 2 lb)',
      );
      expect(api.crear).toHaveBeenCalledTimes(1);

      await user.click(within(dialogo).getByRole('button', { name: 'Reemplazar' }));

      expect(api.crear).toHaveBeenLastCalledWith('p1', expect.anything(), true);
      expect(await screen.findByText('Vínculo reemplazado.')).toBeVisible();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('Cancelar deja todo como estaba', async () => {
      const { api, user } = abrir({}, { crear: vi.fn().mockRejectedValue(conflicto()) });
      await llenar(user);
      await user.click(screen.getByRole('button', { name: 'Vincular' }));

      await user.click(
        within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }),
      );

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(api.crear).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText('Nombre en la tienda')).toHaveValue('Arroz blanco 2 lb');
    });
  });

  it('muestra el error del servidor al vincular', async () => {
    const crear = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 422,
        codigo: 'URL_FUERA_DE_DOMINIO',
        detail: 'La URL no pertenece a walmart.com.gt',
      }),
    );
    const { user } = abrir({}, { crear });
    await llenar(user);
    await user.click(screen.getByRole('button', { name: 'Vincular' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La URL no pertenece a walmart.com.gt',
    );
  });

  describe('editar un vínculo', () => {
    it('cambia nombre en tienda y marca y manda solo lo editable', async () => {
      const { api, user } = abrir({ vinculos: [vinculo()] });
      await user.click(await screen.findByRole('button', { name: 'Editar vínculo de Walmart' }));

      const formulario = screen.getByRole('form', { name: 'Editar vínculo de Walmart' });
      const marca = within(formulario).getByLabelText('Marca');
      await user.clear(marca);
      await user.type(marca, 'Faraón');
      await user.click(within(formulario).getByRole('button', { name: 'Guardar cambios' }));

      expect(api.actualizar).toHaveBeenCalledWith('v1', {
        nombreTienda: 'Arroz blanco 2 lb',
        marca: 'Faraón',
        url: null,
        sku: 'WM-000123',
      });
      expect(await screen.findByText('Vínculo de Walmart actualizado.')).toBeVisible();
      expect(
        screen.queryByRole('form', { name: 'Editar vínculo de Walmart' }),
      ).not.toBeInTheDocument();
    });

    it('vaciar la marca la quita y Cancelar cierra el formulario', async () => {
      const { api, user } = abrir({ vinculos: [vinculo()] });
      await user.click(await screen.findByRole('button', { name: 'Editar vínculo de Walmart' }));
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(
        screen.queryByRole('form', { name: 'Editar vínculo de Walmart' }),
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Editar vínculo de Walmart' }));
      await user.clear(screen.getByLabelText('Marca'));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

      expect(api.actualizar.mock.calls[0]![1]).toMatchObject({ marca: null });
    });

    it('muestra el error del servidor al editar', async () => {
      const actualizar = vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'URL_O_SKU_REQUERIDO',
          detail: 'Para Walmart indica la URL o el SKU del producto',
        }),
      );
      const { user } = abrir({ vinculos: [vinculo()] }, { actualizar });
      await user.click(await screen.findByRole('button', { name: 'Editar vínculo de Walmart' }));
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Para Walmart indica la URL o el SKU',
      );
    });
  });

  it('si no carga, ofrece reintentar', async () => {
    const obtenerProducto = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'El producto no existe.' }),
      )
      .mockResolvedValue(ARROZ);
    const api = {
      supermercados: vi.fn().mockResolvedValue([WALMART]),
      listar: vi.fn().mockResolvedValue([]),
    };
    const catalogo = { obtenerProducto, listarUnidades: vi.fn().mockResolvedValue([LB]) };
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/platillos/productos/p1/supermercados']}>
        <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
          <ContextoApiVinculos.Provider value={api as unknown as ApiVinculos}>
            <Route path="/platillos/productos/:id/supermercados">
              <VinculosProducto />
            </Route>
          </ContextoApiVinculos.Provider>
        </ContextoApiCatalogo.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('El producto no existe.');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Arroz · bolsa 2 lb')).toBeVisible();
  });
});
