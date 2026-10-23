import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import { RESUMEN, apiCatalogoFalsa, pagina } from '../test/catalogo-datos';
import { renderizarCatalogo } from '../test/catalogo';

describe('Platillos (HU-11)', () => {
  it('CA-11.1 lista "Pepián de pollo" con tiempo, proteína y etiquetas; filtra por proteína pollo', async () => {
    const { api } = renderizarCatalogo('/platillos');
    const lista = within(await screen.findByRole('region', { name: 'Lista de platillos' }));
    expect(lista.getByText('Pepián de pollo')).toBeInTheDocument();
    expect(lista.getByText(/Almuerzo · Pollo · típico, fin de semana/)).toBeInTheDocument();
    expect(lista.getByText('Incompleto')).toBeInTheDocument();
    expect(lista.getByRole('link', { name: /Pepián de pollo/ })).toHaveAttribute(
      'href',
      `/platillos/${RESUMEN.id}`,
    );
    await userEvent.selectOptions(screen.getByLabelText('Proteína principal'), 'POLLO');
    await waitFor(() =>
      expect(api.listarPlatillos).toHaveBeenLastCalledWith(
        expect.objectContaining({ proteina: 'POLLO', estado: 'ACTIVO' }),
      ),
    );
    await userEvent.selectOptions(screen.getByLabelText('Tiempo de comida'), 'CENA');
    await waitFor(() =>
      expect(api.listarPlatillos).toHaveBeenLastCalledWith(
        expect.objectContaining({ tiempo: 'CENA' }),
      ),
    );
  });

  it('CA-11.2 el filtro "Inactivos" muestra los platillos inactivados', async () => {
    const api = apiCatalogoFalsa({
      listarPlatillos: vi
        .fn()
        .mockResolvedValueOnce(pagina([]))
        .mockResolvedValue(
          pagina([{ ...RESUMEN, nombre: 'Pescado frito', activo: false, incompleto: false }]),
        ),
    });
    renderizarCatalogo('/platillos', api);
    expect(await screen.findByText('Aún no hay platillos aquí.')).toBeInTheDocument();
    const inactivos = screen.getByRole('button', { name: 'Inactivos' });
    await userEvent.click(inactivos);
    expect(inactivos).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('Pescado frito')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
    expect(api.listarPlatillos).toHaveBeenLastCalledWith(
      expect.objectContaining({ estado: 'INACTIVO' }),
    );
  });

  it('CU-03.1 2a: sin coincidencias ofrece crear el platillo con el texto buscado', async () => {
    const api = apiCatalogoFalsa({ listarPlatillos: vi.fn().mockResolvedValue(pagina([])) });
    renderizarCatalogo('/platillos', api);
    await userEvent.type(screen.getByLabelText('Buscar platillo'), 'Tamales');
    expect(await screen.findByText('Sin coincidencias')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear «Tamales»' })).toHaveAttribute(
      'href',
      '/platillos/nuevo?nombre=Tamales',
    );
    expect(api.listarPlatillos).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Tamales' }));
  });

  it('muestra el error de la API y el aviso de ingrediente inactivo', async () => {
    const api = apiCatalogoFalsa({
      listarPlatillos: vi
        .fn()
        .mockRejectedValueOnce(new ProblemaApi({ status: 500, detail: 'Falló la carga' }))
        .mockResolvedValue(pagina([{ ...RESUMEN, ingredientesInactivos: 1 }])),
    });
    renderizarCatalogo('/platillos', api);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la carga');
    await userEvent.click(screen.getByRole('button', { name: 'Incompletos' }));
    expect(await screen.findByText('Ingrediente inactivo')).toBeInTheDocument();
  });
});
