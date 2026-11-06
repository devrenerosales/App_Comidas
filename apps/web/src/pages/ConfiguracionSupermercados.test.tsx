import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiSupermercados } from '../api/contexto-supermercados';
import { ProblemaApi } from '../api/problema';
import type {
  ApiSupermercados,
  MarcaElegida,
  SupermercadoPreferido,
  VistaMarcasProducto,
} from '../api/supermercados';
import ConfiguracionSupermercados from './ConfiguracionSupermercados';
import { diasDesde, fechaCompleta, textoPrecio } from './supermercados';

const sm = (id: string, nombre: string, preferido: boolean): SupermercadoPreferido => ({
  supermercadoId: id,
  nombre,
  preferido,
});
const PAIZ = sm('s1', 'Paiz', true);
const WALMART = sm('s2', 'Walmart', true);
const TORRE = sm('s3', 'La Torre', false);

const ACEITE = { id: 'p1', nombre: 'Aceite', activo: true };
const SIN_MARCA: VistaMarcasProducto = {
  productoId: 'p1',
  producto: 'Aceite',
  marcaPreferida: null,
  marcas: [
    {
      marca: 'Capullo',
      presentaciones: [{ supermercado: 'Paiz', presentacion: '1 l', ultimoPrecio: null }],
    },
    {
      marca: 'Ideal',
      presentaciones: [
        {
          supermercado: 'Walmart',
          presentacion: '1 l',
          ultimoPrecio: { precio: '24.90', fecha: '2026-10-01' },
        },
      ],
    },
  ],
};
const CON_IDEAL: VistaMarcasProducto = { ...SIN_MARCA, marcaPreferida: 'Ideal' };

function abrir(
  opciones: {
    supermercados?: SupermercadoPreferido[];
    elegidas?: MarcaElegida[];
    producto?: VistaMarcasProducto;
  } = {},
  extra: Partial<Record<keyof ApiSupermercados, unknown>> = {},
) {
  const lista = opciones.supermercados ?? [TORRE, PAIZ, WALMART];
  const api = {
    supermercados: vi.fn().mockResolvedValue(lista),
    guardarSupermercados: vi.fn().mockResolvedValue(lista),
    marcasElegidas: vi.fn().mockResolvedValue(opciones.elegidas ?? []),
    marcasDeProducto: vi.fn().mockResolvedValue(opciones.producto ?? SIN_MARCA),
    guardarMarca: vi.fn().mockResolvedValue(CON_IDEAL),
    ...extra,
  };
  const catalogo = {
    listarProductos: vi.fn().mockResolvedValue({ datos: [ACEITE], paginacion: {} }),
  };
  render(
    <MemoryRouter>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiSupermercados.Provider value={api as unknown as ApiSupermercados}>
          <ConfiguracionSupermercados />
        </ContextoApiSupermercados.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return {
    api: api as typeof api & { marcasElegidas: ReturnType<typeof vi.fn> },
    catalogo,
    user: userEvent.setup(),
  };
}

const casilla = (nombre: string) => screen.findByRole('checkbox', { name: nombre });

async function elegirAceite(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('heading', { name: 'Marca preferida' });
  await user.type(screen.getByLabelText('Buscar producto'), 'ace');
  await user.click(await screen.findByRole('button', { name: 'Elegir Aceite' }));
}

describe('ayudantes de supermercados', () => {
  it('fechaCompleta da dd/mm/aaaa', () => {
    expect(fechaCompleta('2026-10-01')).toBe('01/10/2026');
  });

  it('diasDesde cuenta días de calendario', () => {
    const hoy = new Date(2026, 9, 22, 23, 30);
    expect(diasDesde('2026-10-22', hoy)).toBe(0);
    expect(diasDesde('2026-10-01', hoy)).toBe(21);
    expect(diasDesde('2026-09-30', hoy)).toBe(22);
  });

  it('textoPrecio avisa la fecha solo pasados 14 días (CA-09.4)', () => {
    const hoy = new Date(2026, 9, 22);
    expect(textoPrecio({ precio: '24.90', fecha: '2026-10-01' }, hoy)).toBe(
      'Q24.90 · Precio del 01/10/2026',
    );
    expect(textoPrecio({ precio: '24.90', fecha: '2026-10-08' }, hoy)).toBe('Q24.90');
    expect(textoPrecio({ precio: '24.90', fecha: '2026-10-07' }, hoy)).toBe(
      'Q24.90 · Precio del 07/10/2026',
    );
    expect(textoPrecio(null, hoy)).toBe('Sin precio registrado');
  });
});

describe('HU-09 Supermercados preferidos', () => {
  it('muestra los supermercados con su preferencia y Guardar deshabilitado sin cambios', async () => {
    abrir();
    expect(await casilla('Paiz')).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Walmart' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'La Torre' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar supermercados' })).toBeDisabled();
  });

  it('CA-09.1 marca La Torre y guarda la lista de preferidos', async () => {
    const guardada = [sm('s3', 'La Torre', true), PAIZ, WALMART];
    const { api, user } = abrir({}, { guardarSupermercados: vi.fn().mockResolvedValue(guardada) });

    await user.click(await casilla('La Torre'));
    await user.click(screen.getByRole('button', { name: 'Guardar supermercados' }));

    expect(api.guardarSupermercados).toHaveBeenCalledWith(
      expect.arrayContaining(['s1', 's2', 's3']),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Supermercados guardados.');
    expect(screen.getByRole('button', { name: 'Guardar supermercados' })).toBeDisabled();
  });

  it('CA-09.3 sin ningún supermercado marcado avisa y no guarda', async () => {
    const { api, user } = abrir({ supermercados: [TORRE, PAIZ, sm('s2', 'Walmart', false)] });
    await user.click(await casilla('Paiz'));
    expect(screen.getByRole('checkbox', { name: 'Paiz' })).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Guardar supermercados' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debes tener al menos un supermercado preferido',
    );
    expect(api.guardarSupermercados).not.toHaveBeenCalled();
  });

  it('marcar uno otra vez quita el aviso', async () => {
    const { user } = abrir({ supermercados: [sm('s1', 'Paiz', true)] });
    await user.click(await casilla('Paiz'));
    await user.click(screen.getByRole('button', { name: 'Guardar supermercados' }));
    expect(await screen.findByRole('alert')).toBeVisible();

    await user.click(screen.getByRole('checkbox', { name: 'Paiz' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('muestra el error del servidor al guardar', async () => {
    const guardarSupermercados = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 422,
        codigo: 'SIN_SUPERMERCADO_PREFERIDO',
        detail: 'Sin preferido',
      }),
    );
    const { user } = abrir({}, { guardarSupermercados });
    await user.click(await casilla('La Torre'));
    await user.click(screen.getByRole('button', { name: 'Guardar supermercados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin preferido');
  });

  it('si no carga, ofrece reintentar', async () => {
    const supermercados = vi
      .fn()
      .mockRejectedValueOnce(new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló' }))
      .mockResolvedValue([PAIZ]);
    const { user } = abrir({}, { supermercados });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló');

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await casilla('Paiz')).toBeChecked();
  });
});

describe('HU-09 Marca preferida', () => {
  it('sin marcas elegidas lo indica', async () => {
    abrir();
    expect(await screen.findByText('Todavía no elegiste ninguna marca preferida.')).toBeVisible();
  });

  it('muestra las marcas ya elegidas y permite quitarlas', async () => {
    const quitada = { ...SIN_MARCA, marcaPreferida: null };
    const { api, user } = abrir(
      { elegidas: [{ productoId: 'p1', producto: 'Aceite', marca: 'Ideal' }] },
      { guardarMarca: vi.fn().mockResolvedValue(quitada) },
    );
    const lista = await screen.findByRole('list', { name: 'Marcas elegidas' });
    expect(within(lista).getByText('Aceite: Ideal')).toBeVisible();

    api.marcasElegidas.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Quitar marca de Aceite' }));

    expect(api.guardarMarca).toHaveBeenCalledWith('p1', null);
    expect(await screen.findByText('Aceite vuelve a cualquier marca.')).toBeVisible();
    expect(await screen.findByText('Todavía no elegiste ninguna marca preferida.')).toBeVisible();
  });

  it('CA-09.2 busca el aceite, elige "Ideal" y guarda', async () => {
    const { api, catalogo, user } = abrir();
    await elegirAceite(user);

    expect(catalogo.listarProductos).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'ace', activo: 'true' }),
    );
    expect(api.marcasDeProducto).toHaveBeenCalledWith('p1');
    expect(screen.getByRole('radio', { name: 'Cualquier marca' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Guardar marca' })).toBeDisabled();

    api.marcasElegidas.mockResolvedValue([
      { productoId: 'p1', producto: 'Aceite', marca: 'Ideal' },
    ]);
    await user.click(screen.getByRole('radio', { name: 'Ideal' }));
    await user.click(screen.getByRole('button', { name: 'Guardar marca' }));

    expect(api.guardarMarca).toHaveBeenCalledWith('p1', 'Ideal');
    expect(await screen.findByText('Marca preferida de Aceite: Ideal.')).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Ideal' })).toBeChecked();
    expect(
      within(screen.getByRole('list', { name: 'Marcas elegidas' })).getByText('Aceite: Ideal'),
    ).toBeVisible();
  });

  it('CA-09.4 un precio de hace más de 14 días lleva su fecha; uno sin precio lo dice', async () => {
    const { user } = abrir();
    await elegirAceite(user);

    expect(
      await screen.findByText(/Walmart · 1 l · Q24\.90 · Precio del 01\/10\/2026/),
    ).toBeVisible();
    expect(screen.getByText(/Paiz · 1 l · Sin precio registrado/)).toBeVisible();
  });

  it('un precio reciente no lleva la advertencia de fecha', async () => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const reciente: VistaMarcasProducto = {
      ...SIN_MARCA,
      marcas: [
        {
          marca: 'Ideal',
          presentaciones: [
            {
              supermercado: 'Walmart',
              presentacion: '1 l',
              ultimoPrecio: { precio: '23.50', fecha },
            },
          ],
        },
      ],
    };
    const { user } = abrir({ producto: reciente });
    await elegirAceite(user);
    expect(await screen.findByText('Walmart · 1 l · Q23.50')).toBeVisible();
  });

  it('4a un producto sin marcas vinculadas dice "Sin marcas vinculadas"', async () => {
    const { user } = abrir({ producto: { ...SIN_MARCA, marcas: [] } });
    await elegirAceite(user);
    expect(await screen.findByText(/Sin marcas vinculadas/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Guardar marca' })).not.toBeInTheDocument();
  });

  it('5a volver a "Cualquier marca" guarda null', async () => {
    const { api, user } = abrir({ producto: CON_IDEAL });
    await elegirAceite(user);
    expect(await screen.findByRole('radio', { name: 'Ideal' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Cualquier marca' }));
    await user.click(screen.getByRole('button', { name: 'Guardar marca' }));

    expect(api.guardarMarca).toHaveBeenCalledWith('p1', null);
  });

  it('muestra el error del servidor al guardar la marca', async () => {
    const guardarMarca = vi.fn().mockRejectedValue(
      new ProblemaApi({
        status: 422,
        codigo: 'MARCA_SIN_VINCULO',
        detail: 'La marca no está vinculada',
      }),
    );
    const { user } = abrir({}, { guardarMarca });
    await elegirAceite(user);
    await user.click(screen.getByRole('radio', { name: 'Ideal' }));
    await user.click(screen.getByRole('button', { name: 'Guardar marca' }));
    expect(await screen.findByText('La marca no está vinculada')).toBeVisible();
  });

  it('si no se pueden leer las marcas del producto muestra el error', async () => {
    const marcasDeProducto = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'No existe' }),
      );
    const { user } = abrir({}, { marcasDeProducto });
    await elegirAceite(user);
    expect(await screen.findByText('No existe')).toBeVisible();
  });

  it('una búsqueda sin resultados lo dice y una que falla muestra el error', async () => {
    const { catalogo, user } = abrir();
    await screen.findByRole('heading', { name: 'Marca preferida' });
    catalogo.listarProductos.mockResolvedValueOnce({ datos: [], paginacion: {} });
    await user.type(screen.getByLabelText('Buscar producto'), 'zz');
    expect(await screen.findByText('No hay resultados para «zz».')).toBeVisible();

    catalogo.listarProductos.mockRejectedValueOnce(
      new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Búsqueda caída' }),
    );
    await user.type(screen.getByLabelText('Buscar producto'), 'z');
    expect(await screen.findByText('Búsqueda caída')).toBeVisible();
  });
});
