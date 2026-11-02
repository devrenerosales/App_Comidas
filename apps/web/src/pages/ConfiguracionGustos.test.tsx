import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ApiCatalogo } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiPreferencias } from '../api/contexto-preferencias';
import { ProblemaApi } from '../api/problema';
import type { ApiPreferencias, VistaGustos } from '../api/preferencias';
import ConfiguracionGustos from './ConfiguracionGustos';
import { textoImpacto } from './gustos';

const VACIO: VistaGustos = {
  ingredientesExcluidos: [],
  favoritos: [],
  impacto: { platillosExcluidos: [] },
  advertencias: [],
};
const CHILE = { id: 'p1', nombre: 'Chile pimiento', activo: true };
const RELLENO = { id: 'd1', nombre: 'Chile relleno', activo: true };
const PEPIAN = { id: 'd2', nombre: 'Pepián de pollo', activo: true };
const CON_EXCLUSION: VistaGustos = {
  ...VACIO,
  ingredientesExcluidos: [CHILE],
  impacto: {
    platillosExcluidos: [{ id: 'd1', nombre: 'Chile relleno', ingredientes: ['Chile pimiento'] }],
  },
};

function abrir(
  inicial: VistaGustos = VACIO,
  extra: Partial<Record<keyof ApiPreferencias, unknown>> = {},
) {
  const api = {
    obtener: vi.fn().mockResolvedValue(inicial),
    vistaPrevia: vi.fn().mockResolvedValue(inicial),
    guardar: vi.fn().mockResolvedValue(inicial),
    ...extra,
  };
  const catalogo = {
    listarProductos: vi.fn().mockResolvedValue({ datos: [CHILE], paginacion: {} }),
    listarPlatillos: vi.fn().mockResolvedValue({ datos: [RELLENO, PEPIAN], paginacion: {} }),
  };
  render(
    <MemoryRouter>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiPreferencias.Provider value={api as unknown as ApiPreferencias}>
          <ConfiguracionGustos />
        </ContextoApiPreferencias.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return { api, catalogo, user: userEvent.setup() };
}

describe('textoImpacto', () => {
  it('usa singular y plural', () => {
    expect(textoImpacto(['Chile relleno'])).toBe('1 platillo dejará de sugerirse: Chile relleno');
    expect(textoImpacto(['A', 'B'])).toBe('2 platillos dejarán de sugerirse: A, B');
  });
});

describe('HU-10 Restricciones y gustos', () => {
  it('muestra lo guardado y Guardar deshabilitado mientras no haya cambios', async () => {
    abrir(CON_EXCLUSION);
    const lista = await screen.findByRole('list', { name: 'Ingredientes excluidos' });
    expect(within(lista).getByText('Chile pimiento')).toBeInTheDocument();
    expect(screen.getByText('1 platillo dejará de sugerirse: Chile relleno')).toBeInTheDocument();
    expect(screen.getByText('No hay platillos favoritos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('sin nada guardado indica que no hay ingredientes ni favoritos', async () => {
    abrir();
    expect(await screen.findByText('No hay ingredientes excluidos.')).toBeInTheDocument();
    expect(screen.getByText('No hay platillos favoritos.')).toBeInTheDocument();
  });

  it('CA-10.1 excluir un ingrediente muestra el impacto y guarda', async () => {
    const { api, catalogo, user } = abrir(VACIO, {
      vistaPrevia: vi.fn().mockResolvedValue(CON_EXCLUSION),
      guardar: vi.fn().mockResolvedValue(CON_EXCLUSION),
    });
    await user.type(await screen.findByLabelText('Buscar ingrediente'), 'chi');
    await user.click(await screen.findByRole('button', { name: 'Excluir Chile pimiento' }));
    expect(catalogo.listarProductos).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'chi', activo: 'true' }),
    );
    expect(
      await screen.findByText('1 platillo dejará de sugerirse: Chile relleno'),
    ).toBeInTheDocument();
    expect(api.vistaPrevia).toHaveBeenCalledWith({ ingredientesExcluidos: ['p1'], favoritos: [] });

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.guardar).toHaveBeenCalledWith({ ingredientesExcluidos: ['p1'], favoritos: [] }),
    );
    expect(await screen.findByText('Restricciones y gustos guardados.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('un ingrediente sin platillos lo avisa', async () => {
    const sinPlatillos: VistaGustos = { ...VACIO, ingredientesExcluidos: [CHILE] };
    const { user } = abrir(VACIO, { vistaPrevia: vi.fn().mockResolvedValue(sinPlatillos) });
    await user.type(await screen.findByLabelText('Buscar ingrediente'), 'chi');
    await user.click(await screen.findByRole('button', { name: 'Excluir Chile pimiento' }));
    expect(
      await screen.findByText('Ningún platillo lleva estos ingredientes todavía.'),
    ).toBeInTheDocument();
  });

  it('CA-10.2 marca favoritos y no vuelve a ofrecer los ya elegidos', async () => {
    const dosFavoritos: VistaGustos = { ...VACIO, favoritos: [PEPIAN] };
    const { api, user } = abrir(VACIO, { vistaPrevia: vi.fn().mockResolvedValue(dosFavoritos) });
    await user.type(await screen.findByLabelText('Buscar platillo'), 'pe');
    await user.click(
      await screen.findByRole('button', { name: 'Marcar favorito Pepián de pollo' }),
    );
    const lista = await screen.findByRole('list', { name: 'Platillos favoritos' });
    expect(within(lista).getByText('Pepián de pollo')).toBeInTheDocument();
    expect(api.vistaPrevia).toHaveBeenCalledWith({ ingredientesExcluidos: [], favoritos: ['d2'] });

    await user.type(screen.getByLabelText('Buscar platillo'), 'pe');
    expect(
      await screen.findByRole('button', { name: 'Marcar favorito Chile relleno' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Marcar favorito Pepián de pollo' }),
    ).not.toBeInTheDocument();
  });

  it('CA-10.3 un favorito con ingrediente excluido muestra el aviso', async () => {
    const conflicto: VistaGustos = {
      ...CON_EXCLUSION,
      favoritos: [RELLENO],
      advertencias: [
        {
          codigo: 'FAVORITO_CON_EXCLUIDO',
          platillo: { id: 'd1', nombre: 'Chile relleno' },
          ingredientes: ['Chile pimiento'],
          mensaje: 'Chile relleno contiene un ingrediente excluido: Chile pimiento',
        },
      ],
    };
    const { user } = abrir(CON_EXCLUSION, { vistaPrevia: vi.fn().mockResolvedValue(conflicto) });
    await user.type(await screen.findByLabelText('Buscar platillo'), 'chi');
    await user.click(await screen.findByRole('button', { name: 'Marcar favorito Chile relleno' }));
    expect(
      await screen.findByText(/Chile relleno contiene un ingrediente excluido: Chile pimiento/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('CA-10.4 quitar una exclusión actualiza el impacto y se puede guardar', async () => {
    const { api, user } = abrir(CON_EXCLUSION, {
      vistaPrevia: vi.fn().mockResolvedValue(VACIO),
      guardar: vi.fn().mockResolvedValue(VACIO),
    });
    await user.click(await screen.findByRole('button', { name: 'Quitar Chile pimiento' }));
    expect(await screen.findByText('No hay ingredientes excluidos.')).toBeInTheDocument();
    expect(api.vistaPrevia).toHaveBeenCalledWith({ ingredientesExcluidos: [], favoritos: [] });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(api.guardar).toHaveBeenCalledWith({ ingredientesExcluidos: [], favoritos: [] }),
    );
  });

  it('quitar un favorito lo saca de la lista', async () => {
    const { user } = abrir(
      { ...VACIO, favoritos: [PEPIAN] },
      { vistaPrevia: vi.fn().mockResolvedValue(VACIO) },
    );
    await user.click(await screen.findByRole('button', { name: 'Quitar Pepián de pollo' }));
    expect(await screen.findByText('No hay platillos favoritos.')).toBeInTheDocument();
  });

  it('con menos de 2 letras no busca y sin resultados nuevos lo dice', async () => {
    const { catalogo, user } = abrir(VACIO);
    const campo = await screen.findByLabelText('Buscar ingrediente');
    await user.type(campo, 'c');
    expect(catalogo.listarProductos).not.toHaveBeenCalled();
    catalogo.listarProductos.mockResolvedValueOnce({ datos: [], paginacion: {} });
    await user.type(campo, 'x');
    expect(await screen.findByText('No hay resultados nuevos para «cx».')).toBeInTheDocument();
  });

  it('muestra el error de la búsqueda', async () => {
    const { catalogo, user } = abrir(VACIO);
    catalogo.listarProductos.mockRejectedValue(
      new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló la búsqueda' }),
    );
    await user.type(await screen.findByLabelText('Buscar ingrediente'), 'chi');
    expect(await screen.findByText('Falló la búsqueda')).toBeInTheDocument();
  });

  it('un error al calcular el impacto se muestra', async () => {
    const { user } = abrir(VACIO, {
      vistaPrevia: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 404, codigo: 'NO_ENCONTRADO', detail: 'No existe' }),
        ),
    });
    await user.type(await screen.findByLabelText('Buscar ingrediente'), 'chi');
    await user.click(await screen.findByRole('button', { name: 'Excluir Chile pimiento' }));
    expect(await screen.findByText('No existe')).toBeInTheDocument();
  });

  it('un error al guardar se muestra y conserva los cambios', async () => {
    const { user } = abrir(CON_EXCLUSION, {
      vistaPrevia: vi.fn().mockResolvedValue(VACIO),
      guardar: vi
        .fn()
        .mockRejectedValue(
          new ProblemaApi({ status: 422, codigo: 'INACTIVO', detail: 'Está inactivo' }),
        ),
    });
    await user.click(await screen.findByRole('button', { name: 'Quitar Chile pimiento' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Está inactivo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });

  it('un error de carga permite reintentar', async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló el servidor' }),
      )
      .mockResolvedValueOnce(CON_EXCLUSION);
    const { user } = abrir(VACIO, { obtener });
    expect(await screen.findByText('Falló el servidor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Chile pimiento')).toBeInTheDocument();
  });
});
