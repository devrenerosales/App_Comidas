import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import { ID_PLATILLO, PLATILLO, POLLO_EN_CREMA, apiCatalogoFalsa } from '../test/catalogo-datos';
import { renderizarCatalogo } from '../test/catalogo';

describe('Nuevo y editar platillo (HU-11)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('CA-11.1 crea "Pepián de pollo" para almuerzo, pollo y "típico, fin de semana"', async () => {
    const { api } = renderizarCatalogo('/platillos/nuevo?nombre=Pepi%C3%A1n%20de%20pollo');
    const nombre = await screen.findByLabelText('Nombre del platillo');
    expect(nombre).toHaveValue('Pepián de pollo');
    expect(screen.getByRole('checkbox', { name: 'Almuerzo' })).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText('Proteína principal'), 'POLLO');
    await userEvent.type(screen.getByLabelText('Etiquetas'), 'típico, fin de semana');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(api.crearPlatillo).toHaveBeenCalledWith({
      nombre: 'Pepián de pollo',
      tiempos: ['ALMUERZO'],
      proteinaPrincipal: 'POLLO',
      etiquetas: ['típico', 'fin de semana'],
    });
    // Abre el platillo creado para agregar ingredientes.
    await waitFor(() => expect(api.obtenerPlatillo).toHaveBeenCalledWith(ID_PLATILLO));
    expect(await screen.findByRole('heading', { name: 'Ingredientes' })).toBeInTheDocument();
  });

  it('CA-11.3 duplicado: "Ya existe el platillo Carne guisada" con la opción de abrirlo', async () => {
    const api = apiCatalogoFalsa({
      crearPlatillo: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 409,
          codigo: 'PLATILLO_DUPLICADO',
          detail: 'Ya existe el platillo Carne guisada',
          existenteId: 'pl9',
          existenteNombre: 'Carne guisada',
        }),
      ),
    });
    renderizarCatalogo('/platillos/nuevo', api);
    await userEvent.type(await screen.findByLabelText('Nombre del platillo'), 'carne GUISADA');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(await screen.findByText('Ya existe el platillo Carne guisada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir Carne guisada' })).toHaveAttribute(
      'href',
      '/platillos/pl9',
    );
  });

  it('CA-11.4 sin tiempo de comida: "Selecciona al menos un tiempo de comida" y no llama a la API', async () => {
    const { api } = renderizarCatalogo('/platillos/nuevo');
    await userEvent.type(await screen.findByLabelText('Nombre del platillo'), 'Chile relleno');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Almuerzo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(await screen.findByText('Selecciona al menos un tiempo de comida')).toBeInTheDocument();
    expect(api.crearPlatillo).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Nombre del platillo'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(screen.getByText('Ingresa el nombre del platillo')).toBeInTheDocument();
  });

  it('errores de campo de la API y otros errores', async () => {
    const api = apiCatalogoFalsa({
      crearPlatillo: vi
        .fn()
        .mockRejectedValueOnce(
          new ProblemaApi({
            status: 422,
            codigo: 'NOMBRE_LARGO',
            detail: 'Largo',
            errores: [{ campo: 'nombre', mensaje: 'El nombre admite hasta 80 caracteres' }],
          }),
        )
        .mockRejectedValueOnce(new ProblemaApi({ status: 500, detail: 'Sin servicio' })),
    });
    renderizarCatalogo('/platillos/nuevo', api);
    await userEvent.type(await screen.findByLabelText('Nombre del platillo'), 'Tacos');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(await screen.findByText('El nombre admite hasta 80 caracteres')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(await screen.findByText('Sin servicio')).toBeInTheDocument();
  });

  it('CA-11.2 inactivar con confirmación y reactivar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    const { api } = renderizarCatalogo(`/platillos/${ID_PLATILLO}`);
    const boton = await screen.findByRole('button', { name: 'Inactivar' });
    await userEvent.click(boton);
    expect(api.inactivarPlatillo).not.toHaveBeenCalled();
    await userEvent.click(boton);
    expect(confirmar).toHaveBeenLastCalledWith(
      expect.stringMatching(/Inactivar «Pepián de pollo»/),
    );
    expect(await screen.findByText('Platillo inactivado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar' }));
    expect(await screen.findByText('Platillo reactivado.')).toBeInTheDocument();
    expect(api.reactivarPlatillo).toHaveBeenCalledWith(ID_PLATILLO);
  });

  it('editar guarda los cambios; CA-13.2 muestra "Ingrediente inactivo: Crema"', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi.fn().mockResolvedValue({
        ...POLLO_EN_CREMA,
        advertencias: [
          {
            codigo: 'INGREDIENTE_INACTIVO',
            mensaje: 'Ingrediente inactivo: Crema',
            productoId: 'p-crema',
          },
        ],
      }),
    });
    renderizarCatalogo(`/platillos/${ID_PLATILLO}`, api);
    expect(await screen.findByRole('note')).toHaveTextContent('Ingrediente inactivo: Crema');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Cena' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar platillo' }));
    expect(api.actualizarPlatillo).toHaveBeenCalledWith(
      ID_PLATILLO,
      expect.objectContaining({ nombre: 'Pollo en crema', tiempos: ['ALMUERZO', 'CENA'] }),
    );
    expect(await screen.findByText('Platillo guardado.')).toBeInTheDocument();
  });

  it('error al cargar el platillo', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi
        .fn()
        .mockRejectedValue(new ProblemaApi({ status: 404, detail: 'El platillo no existe.' })),
      inactivarPlatillo: vi.fn().mockRejectedValue(new ProblemaApi({ status: 500, detail: 'x' })),
    });
    renderizarCatalogo(`/platillos/${ID_PLATILLO}`, api);
    expect(await screen.findByText('El platillo no existe.')).toBeInTheDocument();
    expect(PLATILLO.activo).toBe(true);
  });

  it('error al inactivar', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const api = apiCatalogoFalsa({
      inactivarPlatillo: vi
        .fn()
        .mockRejectedValue(new ProblemaApi({ status: 500, detail: 'No se pudo' })),
    });
    renderizarCatalogo(`/platillos/${ID_PLATILLO}`, api);
    await userEvent.click(await screen.findByRole('button', { name: 'Inactivar' }));
    expect(await screen.findByText('No se pudo')).toBeInTheDocument();
  });
});
