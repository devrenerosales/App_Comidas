import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo, Producto, Unidad } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiPrecios } from '../api/contexto-precios';
import { ContextoApiVinculos } from '../api/contexto-vinculos';
import type { ApiPrecios, PrecioRegistrado } from '../api/precios';
import { ProblemaApi } from '../api/problema';
import type { ApiVinculos, SupermercadoCatalogo, Vinculo } from '../api/vinculos';
import RegistrarPrecio from './RegistrarPrecio';
import { hoyEnDispositivo } from './precios';

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

const POLLO = {
  id: 'p1',
  nombre: 'Pollo en piezas',
  tipo: 'AMBOS',
  categoria: { id: 'c1', codigo: 'carnes', nombre: 'Carnes' },
  unidadCompra: 'lb',
  presentacion: { cantidad: '2.000', unidad: LB },
  etiqueta: 'Pollo en piezas · lb 2 lb',
  activo: true,
} as Producto;

const PAIZ: SupermercadoCatalogo = {
  id: 's1',
  nombre: 'Paiz',
  requiereEnlace: true,
  dominio: null,
};
const SUPER_FRESH: SupermercadoCatalogo = {
  id: 's2',
  nombre: 'Super Fresh',
  requiereEnlace: false,
  dominio: null,
};
const LA_TORRE: SupermercadoCatalogo = {
  id: 's3',
  nombre: 'La Torre',
  requiereEnlace: false,
  dominio: null,
};

const vinculo = (extra: Partial<Vinculo> = {}): Vinculo => ({
  id: 'v2',
  productoId: 'p1',
  supermercado: { id: 's2', nombre: 'Super Fresh' },
  nombreTienda: 'Pollo PZ LB',
  marca: null,
  presentacion: { cantidad: '2', unidad: 'lb', texto: '2 lb' },
  factor: '1',
  url: null,
  sku: null,
  activo: true,
  ultimoPrecio: null,
  ...extra,
});

const registrado = (extra: Partial<PrecioRegistrado> = {}): PrecioRegistrado => ({
  id: 'pr1',
  precio: '20.75',
  precioNormalizado: '20.75',
  fechaPrecio: '2026-10-24',
  origen: 'MANUAL',
  vinculo: vinculo(),
  vinculoCreado: false,
  ...extra,
});

function abrir(
  opciones: { vinculos?: Vinculo[]; supermercados?: SupermercadoCatalogo[] } = {},
  extra: Partial<Record<keyof ApiPrecios, unknown>> = {},
) {
  const precios = { registrar: vi.fn().mockResolvedValue(registrado()), ...extra };
  const vinculos = {
    supermercados: vi
      .fn()
      .mockResolvedValue(opciones.supermercados ?? [SUPER_FRESH, LA_TORRE, PAIZ]),
    listar: vi.fn().mockResolvedValue(opciones.vinculos ?? [vinculo()]),
  };
  const catalogo = {
    obtenerProducto: vi.fn().mockResolvedValue(POLLO),
    listarUnidades: vi.fn().mockResolvedValue([LB, LITRO]),
  };
  render(
    <MemoryRouter initialEntries={['/platillos/productos/p1/precio']}>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiVinculos.Provider value={vinculos as unknown as ApiVinculos}>
          <ContextoApiPrecios.Provider value={precios as unknown as ApiPrecios}>
            <Route path="/platillos/productos/:id/precio">
              <RegistrarPrecio />
            </Route>
          </ContextoApiPrecios.Provider>
        </ContextoApiVinculos.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return {
    precios: precios as typeof precios & { registrar: ReturnType<typeof vi.fn> },
    vinculos,
    user: userEvent.setup(),
  };
}

const formulario = () => screen.findByRole('form', { name: 'Registrar precio' });
const guardar = () => screen.getByRole('button', { name: 'Guardar precio' });

describe('hoyEnDispositivo', () => {
  it('da la fecha de calendario del dispositivo en aaaa-mm-dd', () => {
    expect(hoyEnDispositivo(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(hoyEnDispositivo(new Date(2026, 0, 31, 0, 1))).toBe('2026-01-31');
  });
});

describe('HU-34 Registrar precio manual', () => {
  it('muestra la presentación de compra y sobre qué vínculo se registra', async () => {
    abrir();
    await formulario();
    expect(screen.getByText('Pollo en piezas · lb 2 lb')).toBeVisible();
    expect(screen.getByText(/Se registra sobre «Pollo PZ LB» \(2 lb\)/)).toBeVisible();
    expect(screen.getByLabelText('Fecha de compra')).toHaveValue(hoyEnDispositivo());
  });

  it('CA-34.1 registra el precio de Super Fresh sobre su vínculo', async () => {
    const { precios, user } = abrir();
    await formulario();
    await user.type(screen.getByLabelText('Precio (Q)'), '20.75');
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '2026-10-24' } });

    await user.click(guardar());

    expect(precios.registrar).toHaveBeenCalledWith({
      productoSupermercadoId: 'v2',
      precio: '20.75',
      fechaPrecio: '2026-10-24',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Precio guardado: Q20.75 en Super Fresh (24/10/2026).',
    );
    expect(screen.getByLabelText('Precio (Q)')).toHaveValue('');
  });

  it('con coma decimal manda el precio con punto y dos decimales', async () => {
    const { precios, user } = abrir();
    await formulario();
    await user.type(screen.getByLabelText('Precio (Q)'), '6,5');
    await user.click(guardar());
    expect(precios.registrar.mock.calls[0]![0].precio).toBe('6.50');
  });

  it('CA-35.2 muestra el precio por tu presentación cuando el vínculo tiene otro factor', async () => {
    const { user } = abrir({ vinculos: [vinculo({ factor: '2.5' })] });
    await formulario();
    await user.type(screen.getByLabelText('Precio (Q)'), '31.25');
    expect(screen.getByText(/Equivale a Q12\.50 por tu presentación/)).toBeVisible();
  });

  it('1a sin vínculo pide la presentación y avisa que se creó el vínculo', async () => {
    const { precios, user } = abrir({
      vinculos: [],
      supermercados: [SUPER_FRESH, LA_TORRE],
    });
    await formulario();
    expect(screen.getByText(/todavía no está vinculado con Super Fresh/)).toBeVisible();
    expect(screen.getByLabelText('Cantidad de la presentación')).toHaveValue('2');
    expect(screen.getByLabelText('Unidad')).toHaveValue('u-lb');
    precios.registrar.mockResolvedValue(registrado({ vinculoCreado: true }));

    await user.type(screen.getByLabelText('Precio (Q)'), '20.75');
    await user.click(guardar());

    expect(precios.registrar).toHaveBeenCalledWith({
      productoId: 'p1',
      supermercadoId: 's2',
      presentacionCantidad: '2',
      presentacionUnidadId: 'u-lb',
      precio: '20.75',
      fechaPrecio: hoyEnDispositivo(),
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Se creó el vínculo con este supermercado.',
    );
  });

  it('Paiz sin vínculo pide crearlo primero con URL o SKU y no deja guardar', async () => {
    const { user } = abrir({ vinculos: [] });
    await formulario();

    await user.selectOptions(screen.getByLabelText('Supermercado'), 's1');

    expect(screen.getByText(/Paiz se consulta automáticamente/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Crear el vínculo' })).toHaveAttribute(
      'href',
      '/platillos/productos/p1/supermercados',
    );
    expect(guardar()).toBeDisabled();
  });

  describe('CA-34.4 datos inválidos', () => {
    it.each([
      ['0.00', 'El precio debe ser mayor que 0'],
      ['12.905', 'El precio admite como máximo 2 decimales'],
      ['abc', 'Ingresa un precio válido (usa punto para los decimales)'],
      ['', 'Ingresa un precio válido (usa punto para los decimales)'],
    ])('el precio %p muestra el mensaje y no guarda', async (valor, mensaje) => {
      const { precios, user } = abrir();
      await formulario();
      if (valor) await user.type(screen.getByLabelText('Precio (Q)'), valor);

      await user.click(guardar());

      expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
      expect(precios.registrar).not.toHaveBeenCalled();
    });

    it('una fecha futura muestra el mensaje y no guarda', async () => {
      const { precios, user } = abrir();
      await formulario();
      await user.type(screen.getByLabelText('Precio (Q)'), '12.90');
      fireEvent.change(screen.getByLabelText('Fecha de compra'), {
        target: { value: '2999-01-01' },
      });

      await user.click(guardar());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La fecha de compra no puede ser futura',
      );
      expect(precios.registrar).not.toHaveBeenCalled();
    });

    it('muestra los dos errores a la vez y los quita al corregir', async () => {
      const { user } = abrir();
      await formulario();
      await user.type(screen.getByLabelText('Precio (Q)'), '0');
      fireEvent.change(screen.getByLabelText('Fecha de compra'), {
        target: { value: '2999-01-01' },
      });
      await user.click(guardar());
      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('El precio debe ser mayor que 0');
      expect(alerta).toHaveTextContent('La fecha de compra no puede ser futura');

      await user.type(screen.getByLabelText('Precio (Q)'), '5');

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('muestra el error del servidor al guardar', async () => {
    const registrar = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 422,
        codigo: 'UNIDAD_NO_CONVERTIBLE',
        detail: 'La unidad de la presentación no es convertible a libras',
      }),
    );
    const { user } = abrir({}, { registrar });
    await formulario();
    await user.type(screen.getByLabelText('Precio (Q)'), '5');
    await user.click(guardar());
    expect(await screen.findByRole('alert')).toHaveTextContent('no es convertible a libras');
  });

  it('si no carga, ofrece reintentar', async () => {
    const obtenerProducto = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'El producto no existe.' }),
      )
      .mockResolvedValue(POLLO);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/platillos/productos/p1/precio']}>
        <ContextoApiCatalogo.Provider
          value={
            {
              obtenerProducto,
              listarUnidades: vi.fn().mockResolvedValue([LB]),
            } as unknown as ApiCatalogo
          }
        >
          <ContextoApiVinculos.Provider
            value={
              {
                supermercados: vi.fn().mockResolvedValue([SUPER_FRESH]),
                listar: vi.fn().mockResolvedValue([vinculo()]),
              } as unknown as ApiVinculos
            }
          >
            <ContextoApiPrecios.Provider value={{ registrar: vi.fn() } as unknown as ApiPrecios}>
              <Route path="/platillos/productos/:id/precio">
                <RegistrarPrecio />
              </Route>
            </ContextoApiPrecios.Provider>
          </ContextoApiVinculos.Provider>
        </ContextoApiCatalogo.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('El producto no existe.');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Pollo en piezas · lb 2 lb')).toBeVisible();
  });
});
