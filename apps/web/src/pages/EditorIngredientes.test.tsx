import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProblemaApi } from '../api/problema';
import {
  CREMA,
  ID_PLATILLO,
  LB,
  ML,
  PECHUGA,
  PLATILLO,
  POLLO_EN_CREMA,
  apiCatalogoFalsa,
  pagina,
  producto,
  vistaPrevia,
} from '../test/catalogo-datos';
import { renderizarCatalogo } from '../test/catalogo';

const abrir = (api = apiCatalogoFalsa()) => renderizarCatalogo(`/platillos/${ID_PLATILLO}`, api);

async function agregar(texto: string, etiqueta: string) {
  const buscador = await screen.findByLabelText('Agregar ingrediente del catálogo');
  await userEvent.clear(buscador);
  await userEvent.type(buscador, texto);
  await userEvent.click(await screen.findByRole('button', { name: `Agregar ${etiqueta}` }));
}

describe('Editor de ingredientes (HU-12)', () => {
  it('CA-12.1 agrego "Pechuga de pollo" 2 lb y "Crema" 250 ml; con Σ 6.0 la vista previa muestra 3 lb y 375 ml', async () => {
    const api = apiCatalogoFalsa({
      guardarIngredientes: vi.fn().mockResolvedValue({
        ...POLLO_EN_CREMA,
        vistaPrevia: vistaPrevia('6.00', ['3.000', '375.000']),
      }),
    });
    abrir(api);
    expect(await screen.findByText(/el platillo queda «Incompleto»/)).toBeInTheDocument();
    await agregar('pollo', PECHUGA.etiqueta);
    await userEvent.type(screen.getByLabelText('Cantidad de Pechuga de pollo'), '2');
    await agregar('crema', CREMA.etiqueta);
    await userEvent.type(screen.getByLabelText('Cantidad de Crema'), '250');
    // Solo se ofrecen unidades de la misma magnitud que la presentación.
    const unidadCrema = screen.getByLabelText('Unidad de Crema');
    expect(
      within(unidadCrema)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['ml', 'taza']);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingredientes' }));
    expect(api.guardarIngredientes).toHaveBeenCalledWith(ID_PLATILLO, 4, [
      { productoId: PECHUGA.id, cantidad: '2', unidadId: LB.id },
      { productoId: CREMA.id, cantidad: '250', unidadId: ML.id },
    ]);
    const vista = within(await screen.findByRole('region', { name: 'Cantidades para tu hogar' }));
    expect(vista.getByText('3 lb')).toBeInTheDocument();
    expect(vista.getByText('375 ml')).toBeInTheDocument();
    expect(screen.getByLabelText('Porciones a preparar (Σ factores)')).toHaveValue(6);
  });

  it('CA-12.5 Σ factores 2.5: "Pechuga de pollo" 1.25 lb y "Crema" 156.25 ml; ajustar Σ recalcula', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi.fn().mockResolvedValue(POLLO_EN_CREMA),
      vistaPrevia: vi.fn().mockResolvedValue(vistaPrevia('2.50', ['1.250', '156.250'])),
    });
    abrir(api);
    const vista = within(await screen.findByRole('region', { name: 'Cantidades para tu hogar' }));
    expect(await vista.findByText('1.25 lb')).toBeInTheDocument();
    expect(vista.getByText('156.25 ml')).toBeInTheDocument();
    const suma = screen.getByLabelText('Porciones a preparar (Σ factores)');
    await userEvent.clear(suma);
    await userEvent.type(suma, '8');
    expect(vista.getByText('4 lb')).toBeInTheDocument();
    expect(vista.getByText('500 ml')).toBeInTheDocument();
    await userEvent.clear(suma);
    expect(vista.getByText('1.25 lb')).toBeInTheDocument();
  });

  it('CA-12.2 crea "Miltomate" desde el buscador (lb, 1 lb) y lo agrega con 1 lb', async () => {
    const miltomate = producto('Miltomate', LB, { etiqueta: 'Miltomate · lb 1 lb' });
    const api = apiCatalogoFalsa({
      listarProductos: vi.fn().mockResolvedValue(pagina([])),
      crearProducto: vi.fn().mockResolvedValue(miltomate),
      guardarIngredientes: vi.fn().mockResolvedValue({
        ...PLATILLO,
        vistaPrevia: { ...vistaPrevia('4.00', ['1', '1']), ingredientes: [] },
      }),
    });
    abrir(api);
    await userEvent.type(
      await screen.findByLabelText('Agregar ingrediente del catálogo'),
      'Miltomate',
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Crear producto «Miltomate»' }),
    );
    const form = within(screen.getByRole('form', { name: 'Nuevo producto' }));
    expect(form.getByLabelText('Nombre del producto')).toHaveValue('Miltomate');
    await userEvent.type(form.getByLabelText(/Unidad de compra/), 'lb');
    await userEvent.click(form.getByRole('button', { name: 'Guardar producto' }));
    expect(api.crearProducto).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Miltomate',
        unidadCompra: 'lb',
        presentacionCantidad: '1',
        presentacionUnidadId: LB.id,
      }),
    );
    await userEvent.type(await screen.findByLabelText('Cantidad de Miltomate'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingredientes' }));
    expect(api.guardarIngredientes).toHaveBeenCalledWith(ID_PLATILLO, 4, [
      { productoId: miltomate.id, cantidad: '1', unidadId: LB.id },
    ]);
    expect(await screen.findByText('Ingredientes guardados.')).toBeInTheDocument();
  });

  it('CA-12.3 "La unidad ml no es compatible con lb" de la API se marca en el ingrediente', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi.fn().mockResolvedValue(POLLO_EN_CREMA),
      guardarIngredientes: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'UNIDAD_INCOMPATIBLE',
          detail: 'La unidad ml no es compatible con lb',
          errores: [
            { campo: 'ingredientes.0.unidadId', mensaje: 'La unidad ml no es compatible con lb' },
          ],
        }),
      ),
    });
    abrir(api);
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar ingredientes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La unidad ml no es compatible con lb',
    );
    expect(screen.getByLabelText('Unidad de Pechuga de pollo')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('CA-12.4 cantidad 0: "La cantidad debe ser mayor que 0" y no guarda', async () => {
    const api = apiCatalogoFalsa({ obtenerPlatillo: vi.fn().mockResolvedValue(POLLO_EN_CREMA) });
    abrir(api);
    const cantidad = await screen.findByLabelText('Cantidad de Pechuga de pollo');
    await userEvent.clear(cantidad);
    await userEvent.type(cantidad, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingredientes' }));
    expect(screen.getByText('La cantidad debe ser mayor que 0')).toBeInTheDocument();
    expect(cantidad).toHaveAttribute('aria-invalid', 'true');
    expect(api.guardarIngredientes).not.toHaveBeenCalled();
  });

  it('CU-03.2 E3, porciones fuera de rango, quitar y convertir unidades', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi.fn().mockResolvedValue(POLLO_EN_CREMA),
      guardarIngredientes: vi
        .fn()
        .mockRejectedValue(new ProblemaApi({ status: 500, detail: 'Sin servicio' })),
    });
    abrir(api);
    await agregar('pollo', PECHUGA.etiqueta);
    expect(await screen.findByText(/Pechuga de pollo ya está en el platillo/)).toBeInTheDocument();
    // lb → g convierte la cantidad (2 lb = 907.185 g).
    await userEvent.selectOptions(screen.getByLabelText('Unidad de Pechuga de pollo'), 'u-g');
    expect(screen.getByLabelText('Cantidad de Pechuga de pollo')).toHaveValue('907.185');
    await userEvent.click(screen.getByRole('button', { name: 'Quitar Crema' }));
    expect(screen.queryByLabelText('Cantidad de Crema')).not.toBeInTheDocument();
    const porciones = screen.getByLabelText('Porciones base');
    await userEvent.clear(porciones);
    await userEvent.type(porciones, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingredientes' }));
    expect(
      screen.getByText(/Las porciones base deben ser un número entero de 1 a 20/),
    ).toBeInTheDocument();
    await userEvent.clear(porciones);
    await userEvent.type(porciones, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar ingredientes' }));
    await waitFor(() =>
      expect(api.guardarIngredientes).toHaveBeenCalledWith(ID_PLATILLO, 6, [
        { productoId: PECHUGA.id, cantidad: '907.185', unidadId: 'u-g' },
      ]),
    );
    expect(await screen.findByText('Sin servicio')).toBeInTheDocument();
  });
});
