import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import {
  ContextoApiImportaciones,
  crearApiImportaciones,
  type VistaImportacion,
} from '../api/importaciones';
import ImportarHistorial from './ImportarHistorial';
import { ProblemaApi } from '../api/problema';
const VISTA: VistaImportacion = {
  id: 'i1',
  nombreArchivo: 'menus.csv',
  estado: 'VISTA_PREVIA',
  revision: 'r1',
  totalFilas: 21,
  filasConError: 0,
  pendientes: [],
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
    {
      semanaInicio: '2025-04-13',
      fechaFin: '2025-04-19',
      decision: 'OMITIR',
      gastoSemana: '241.75',
      existente: { gastoReal: '224.00', estado: 'HISTORICO' },
      puedeReemplazar: true,
    },
  ],
};
function abrir({ vista = VISTA, nuevo = false, rol = 'ADMIN', fallo = false } = {}) {
  const api = {
    cargar: vi.fn().mockResolvedValue(vista),
    obtener: vi.fn().mockResolvedValue(vista),
    plantilla: vi.fn(),
    decidir: vi.fn().mockResolvedValue({ ...vista, revision: 'r2' }),
    confirmar: vi.fn().mockResolvedValue({}),
    cancelar: vi.fn().mockResolvedValue({ ...vista, revision: null, estado: 'CANCELADA' }),
    filas: vi.fn().mockResolvedValue({ datos: [], paginacion: { totalPaginas: 0 } }),
    platillos: vi.fn().mockResolvedValue({ datos: [], paginacion: { totalPaginas: 0 } }),
    decidirPlatillos: vi.fn(),
  };
  if (fallo)
    api.confirmar.mockRejectedValue(
      new ProblemaApi({ status: 409, codigo: 'SEMANA_MODIFICADA', detail: 'La semana cambió' }),
    );
  render(
    <MemoryRouter initialEntries={[nuevo ? '/historial/importar' : '/historial/importar/i1']}>
      <ContextoAuth.Provider value={{ hogar: { rol } } as ValorAuth}>
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
describe('Importación histórica', () => {
  it('envía archivo y abre la vista previa persistida', async () => {
    const { api, user } = abrir({ nuevo: true });
    const archivo = new File(['fecha,tiempo_comida,platillo'], 'menus.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('Archivo de menús'), archivo);
    await user.click(screen.getByRole('button', { name: 'Revisar archivo' }));
    expect(api.cargar).toHaveBeenCalledWith(archivo);
    expect(await screen.findByText('menus.csv')).toBeInTheDocument();
  });
  it('bloquea archivos mayores de 5 MB antes de enviarlos', async () => {
    const { api, user } = abrir({ nuevo: true });
    const archivo = new File(['x'], 'grande.csv');
    Object.defineProperty(archivo, 'size', { value: 5242881 });
    fireEvent.change(screen.getByLabelText('Archivo de menús'), { target: { files: [archivo] } });
    await user.click(screen.getByRole('button', { name: 'Revisar archivo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('5 MB');
    expect(api.cargar).not.toHaveBeenCalled();
  });
  it('omite por defecto y envía revisión actual al decidir reemplazar', async () => {
    const { api, user } = abrir();
    const selector = await screen.findByLabelText('Acción para 2025-04-13');
    expect(selector).toHaveValue('OMITIR');
    await user.selectOptions(selector, 'REEMPLAZAR');
    expect(api.decidir).toHaveBeenCalledWith('i1', 'r1', '2025-04-13', 'REEMPLAZAR');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar importación' }));
    expect(api.confirmar).toHaveBeenCalledWith('i1', 'r2');
  });
  it('muestra errores y pendientes; no permite confirmar', async () => {
    const { api } = abrir({
      vista: {
        ...VISTA,
        estado: 'CON_ERRORES',
        filasConError: 2,
        pendientes: ['Caldito'],
        puedeConfirmar: false,
      },
    });
    expect(await screen.findByText(/Falta 1 platillo por resolver/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importación' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Corrige los errores');
    expect(api.confirmar).not.toHaveBeenCalled();
  });
  it('descarta la carga al cancelar y muestra el cierre', async () => {
    const { api, user } = abrir();
    await user.click(await screen.findByRole('button', { name: 'Cancelar importación' }));
    expect(api.cancelar).toHaveBeenCalledWith('i1', 'r1');
    expect(await screen.findByRole('status')).toHaveTextContent('Importación cancelada');
    expect(screen.queryByRole('button', { name: 'Confirmar importación' })).not.toBeInTheDocument();
  });
  it('muestra conflicto sin reintentar la confirmación automáticamente', async () => {
    const { api, user } = abrir({ fallo: true });
    await user.click(await screen.findByRole('button', { name: 'Confirmar importación' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La semana cambió');
    expect(api.confirmar).toHaveBeenCalledTimes(1);
  });
  it('prohíbe el reemplazo de semana protegida', async () => {
    abrir({ vista: { ...VISTA, semanas: [{ ...VISTA.semanas[1]!, puedeReemplazar: false }] } });
    expect(await screen.findByText('Esta semana está protegida y se omitirá.')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Reemplazar todo' })).not.toBeInTheDocument();
  });
  it('no solicita datos para miembros sin permiso', () => {
    const { api } = abrir({ rol: 'MIEMBRO' });
    expect(screen.getByText(/Solo la persona administradora/)).toBeInTheDocument();
    expect(api.obtener).not.toHaveBeenCalled();
  });
  it('el contrato HTTP usa multipart y revisión para todas las mutaciones', async () => {
    const peticion = vi.fn().mockResolvedValue({});
    const api = crearApiImportaciones({ peticion });
    const archivo = new File(['datos'], 'menus.csv');
    await api.cargar(archivo);
    const cuerpo = peticion.mock.calls[0]![1].cuerpo as FormData;
    expect(cuerpo.get('archivo')).toBe(archivo);
    expect(cuerpo.get('origen')).toBe('ARCHIVO');
    await api.plantilla('xlsx');
    expect(peticion).toHaveBeenLastCalledWith('/importaciones/plantilla?formato=xlsx', {
      respuesta: 'blob',
    });
    await api.decidir('i1', 'r1', '2025-04-13', 'OMITIR');
    expect(peticion).toHaveBeenLastCalledWith('/importaciones/i1/semanas', {
      metodo: 'PUT',
      cuerpo: { revision: 'r1', decisiones: [{ semanaInicio: '2025-04-13', decision: 'OMITIR' }] },
    });
    await api.platillos('i1', 'revisar', 2);
    expect(peticion).toHaveBeenLastCalledWith(
      '/importaciones/i1/platillos?estado=revisar&pagina=2',
    );
    await api.decidirPlatillos('i1', 'r1', { aceptarPropuestas: true });
    expect(peticion).toHaveBeenLastCalledWith('/importaciones/i1/platillos', {
      metodo: 'PUT',
      cuerpo: { revision: 'r1', aceptarPropuestas: true },
    });
    await api.cancelar('i1', 'r1');
    expect(peticion).toHaveBeenLastCalledWith('/importaciones/i1/cancelar', {
      metodo: 'POST',
      cuerpo: { revision: 'r1' },
    });
  });
});
