import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import {
  ContextoApiImportaciones,
  crearApiImportaciones,
  type ReporteImportacion,
  type VistaImportacion,
} from '../api/importaciones';
import ImportarHistorial from './ImportarHistorial';

const LISTAS = [
  {
    lista: 'Despensa marzo',
    tipo: 'DESPENSA' as const,
    productos: 35,
    total: '814.00',
    nuevos: 30,
  },
  { lista: 'Compras sueltas', tipo: 'COMPRAS' as const, productos: 12, total: null, nuevos: 4 },
];
const VISTA: VistaImportacion = {
  id: 'i1',
  nombreArchivo: 'menus.csv',
  estado: 'VISTA_PREVIA',
  origen: 'CUADERNO',
  revision: 'r1',
  totalFilas: 138,
  filasConError: 0,
  pendientes: [],
  listas: LISTAS,
  puedeConfirmar: true,
  reporte: null,
  semanas: [
    {
      semanaInicio: '2025-04-06',
      fechaFin: '2025-04-12',
      decision: 'CREAR',
      gastoSemana: '224.00',
      existente: null,
      puedeReemplazar: false,
    },
  ],
};
const REPORTE: ReporteImportacion = {
  semanasCreadas: 17,
  reemplazadas: 0,
  omitidas: 0,
  platillosCreados: 0,
  aliasCreados: 0,
  despensaCargada: 35,
  productosCreados: 34,
  gastoSemanal: { semanas: 7, minimo: '104.00', maximo: '265.00', promedio: '214.71' },
  listas: LISTAS,
};

function abrir({ vista = VISTA, nuevo = false } = {}) {
  const api = {
    cargar: vi.fn().mockResolvedValue(vista),
    obtener: vi.fn().mockResolvedValue(vista),
    plantilla: vi.fn().mockResolvedValue(new Blob(['x'])),
    decidir: vi.fn(),
    confirmar: vi.fn().mockResolvedValue(REPORTE),
    cancelar: vi.fn(),
    filas: vi.fn().mockResolvedValue({ datos: [], paginacion: { totalPaginas: 0 } }),
    platillos: vi.fn().mockResolvedValue({ datos: [], paginacion: { totalPaginas: 0 } }),
    decidirPlatillos: vi.fn(),
  };
  render(
    <MemoryRouter initialEntries={[nuevo ? '/historial/importar' : '/historial/importar/i1']}>
      <ContextoAuth.Provider value={{ hogar: { rol: 'ADMIN' } } as ValorAuth}>
        <ContextoApiImportaciones.Provider value={api}>
          <Route path="/historial/importar/:id?">
            <ImportarHistorial />
          </Route>
        </ContextoApiImportaciones.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  return { api, user: userEvent.setup() };
}

describe('HU-18 Carga inicial del cuaderno en pantalla', () => {
  it('las listas solo se piden al marcar la carga del cuaderno y se envían junto con los menús', async () => {
    const { api, user } = abrir({ nuevo: true });
    expect(screen.queryByLabelText(/Archivo de listas/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Carga inicial del cuaderno/));
    const menus = new File(['fecha,tiempo_comida,platillo'], 'menus.csv', { type: 'text/csv' });
    const listas = new File(['fecha,lista'], 'listas.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Archivo de menús'), menus);
    await user.upload(screen.getByLabelText(/Archivo de listas/), listas);
    await user.click(screen.getByRole('button', { name: 'Revisar archivo' }));
    expect(api.cargar).toHaveBeenCalledWith(menus, { listas });
  });
  it('desmarcar la carga del cuaderno descarta el archivo de listas elegido', async () => {
    const { api, user } = abrir({ nuevo: true });
    const casilla = screen.getByLabelText(/Carga inicial del cuaderno/);
    await user.click(casilla);
    await user.upload(
      screen.getByLabelText(/Archivo de listas/),
      new File(['x'], 'listas.csv', { type: 'text/csv' }),
    );
    await user.click(casilla);
    const menus = new File(['x'], 'menus.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Archivo de menús'), menus);
    await user.click(screen.getByRole('button', { name: 'Revisar archivo' }));
    expect(api.cargar).toHaveBeenCalledWith(menus);
  });
  it('ofrece las plantillas de listas y del cuaderno', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const { api, user } = abrir({ nuevo: true });
    await user.click(screen.getByLabelText(/Carga inicial del cuaderno/));
    await user.click(screen.getByRole('button', { name: 'Plantilla de listas CSV' }));
    expect(api.plantilla).toHaveBeenLastCalledWith('csv', 'listas');
    await user.click(screen.getByRole('button', { name: 'Plantilla Excel del cuaderno' }));
    expect(api.plantilla).toHaveBeenLastCalledWith('xlsx', 'cuaderno');
  });
  it('muestra el resumen de listas antes de confirmar', async () => {
    abrir();
    const tabla = await screen.findByRole('table', { name: 'Resumen de listas por cargar' });
    const despensa = within(tabla).getByRole('row', { name: /Despensa marzo/ });
    expect(despensa).toHaveTextContent('Despensa');
    expect(despensa).toHaveTextContent('35');
    expect(despensa).toHaveTextContent('814.00');
    expect(within(tabla).getByRole('row', { name: /Compras sueltas/ })).toHaveTextContent(
      'Sin precios',
    );
  });
  it('tras confirmar muestra el reporte de conciliación con gasto mínimo, máximo y promedio', async () => {
    const { api, user } = abrir();
    const confirmar = await screen.findByRole('button', { name: 'Confirmar importación' });
    api.obtener.mockResolvedValue({
      ...VISTA,
      estado: 'CONFIRMADA',
      revision: null,
      reporte: REPORTE,
    });
    await user.click(confirmar);
    const reporte = await screen.findByRole('region', { name: 'Reporte de conciliación' });
    expect(within(reporte).getByText('Gasto semanal mínimo').nextSibling).toHaveTextContent(
      '104.00',
    );
    expect(within(reporte).getByText('Gasto semanal máximo').nextSibling).toHaveTextContent(
      '265.00',
    );
    expect(within(reporte).getByText('Gasto semanal promedio').nextSibling).toHaveTextContent(
      '214.71',
    );
    expect(within(reporte).getByRole('table', { name: 'Listas cargadas' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('35 productos de despensa');
    expect(screen.getByRole('status')).toHaveTextContent('34 productos en el catálogo');
  });
  it('el reporte avisa cuando ninguna semana trae gasto', async () => {
    abrir({
      vista: {
        ...VISTA,
        estado: 'CONFIRMADA',
        revision: null,
        reporte: { ...REPORTE, gastoSemanal: null },
      },
    });
    expect(
      await screen.findByText(/Ninguna de las semanas importadas trae gasto/),
    ).toBeInTheDocument();
  });
  it('permite revisar las filas de la hoja de listas', async () => {
    const { api, user } = abrir();
    api.filas.mockResolvedValue({
      datos: [
        {
          numeroFila: 5,
          datos: { fecha: '2026-03-01', lista: 'Despensa marzo', producto: 'Leche' },
          errores: [{ columna: 'cantidad', motivo: 'La cantidad debe ser mayor que 0' }],
        },
      ],
      paginacion: { totalPaginas: 1 },
    });
    await user.selectOptions(await screen.findByLabelText('Hoja a revisar'), 'LISTAS');
    await waitFor(() => expect(api.filas).toHaveBeenLastCalledWith('i1', 1, true, 'LISTAS'));
    expect(
      await screen.findByText(/Fila 5: 2026-03-01 · Despensa marzo · Leche/),
    ).toBeInTheDocument();
    expect(screen.getByText(/cantidad: La cantidad debe ser mayor que 0/)).toBeInTheDocument();
  });
  it('una importación normal no muestra listas ni el selector de hoja', async () => {
    abrir({ vista: { ...VISTA, origen: 'ARCHIVO', listas: [] } });
    await screen.findByText('menus.csv');
    expect(screen.queryByLabelText('Hoja a revisar')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Listas del cuaderno' })).not.toBeInTheDocument();
  });
  it('el contrato HTTP envía origen cuaderno, las listas y la hoja pedida', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiImportaciones({ peticion });
    const menus = new File(['m'], 'menus.csv');
    const listas = new File(['l'], 'listas.csv');
    await api.cargar(menus, { listas });
    const cuerpo = peticion.mock.calls[0]![1].cuerpo as FormData;
    expect(cuerpo.get('origen')).toBe('CUADERNO');
    expect(cuerpo.get('archivo')).toBe(menus);
    expect(cuerpo.get('listas')).toBe(listas);
    await api.cargar(menus, {});
    expect((peticion.mock.calls[1]![1].cuerpo as FormData).has('listas')).toBe(false);
    await api.plantilla('csv', 'listas');
    expect(peticion).toHaveBeenLastCalledWith('/importaciones/plantilla?formato=csv&hoja=listas', {
      respuesta: 'blob',
    });
    await api.filas('i1', 2, false, 'LISTAS');
    expect(peticion).toHaveBeenLastCalledWith(
      '/importaciones/i1/filas?pagina=2&soloErrores=false&hoja=LISTAS',
    );
  });
});
