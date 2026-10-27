import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiHistorial } from '../api/contexto-historial';
import type { ApiCatalogo } from '../api/catalogo';
import type { ApiHistorial } from '../api/historial';
import { ProblemaApi } from '../api/problema';
import CapturarSemana from './CapturarSemana';
import Historial from './Historial';

const PAGINA_VACIA = {
  datos: [],
  paginacion: { pagina: 1, tamano: 20, total: 0, totalPaginas: 0 },
};
function abrir({ extra = {}, catalogo = {}, rol = 'ADMIN', lista = false } = {}) {
  const api = {
    capturar: vi.fn().mockResolvedValue({ id: 's1' }),
    listar: vi.fn().mockResolvedValue(PAGINA_VACIA),
    ...extra,
  };
  const cat = {
    listarPlatillos: vi
      .fn()
      .mockResolvedValue({ ...PAGINA_VACIA, datos: [{ id: 'p1', nombre: 'Pepián de pollo' }] }),
    crearPlatillo: vi.fn().mockResolvedValue({ id: 'p2', nombre: 'Sopa de verduras' }),
    ...catalogo,
  };
  render(
    <MemoryRouter initialEntries={[lista ? '/historial' : '/historial/capturar']}>
      <ContextoAuth.Provider value={{ hogar: { id: 'h1', rol } } as ValorAuth}>
        <ContextoApiHistorial.Provider value={api as unknown as ApiHistorial}>
          <ContextoApiCatalogo.Provider value={cat as unknown as ApiCatalogo}>
            <Switch>
              <Route exact path="/historial/capturar">
                <CapturarSemana />
              </Route>
              <Route
                path="/historial"
                render={({ location }) =>
                  lista ? (
                    <Historial />
                  ) : (
                    <p role="status">{(location.state as { aviso?: string })?.aviso}</p>
                  )
                }
              />
            </Switch>
          </ContextoApiCatalogo.Provider>
        </ContextoApiHistorial.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  return { api, cat, user: userEvent.setup() };
}
function fecha(valor = '2025-04-06') {
  fireEvent.change(screen.getByLabelText('Domingo de inicio'), { target: { value: valor } });
}
async function elegir(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Elegir Almuerzo Domingo' }));
  await user.click(await screen.findByRole('button', { name: 'Pepián de pollo' }));
}

describe('HU-15 Captura histórica', () => {
  it('captura una comida, gasto semanal y días vacíos usando el catálogo', async () => {
    const { api, user } = abrir();
    fecha();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    await elegir(user);
    await user.type(screen.getByLabelText('Gasto semanal (Q), opcional'), '248.50');
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(api.capturar).toHaveBeenCalledWith({
      fechaInicio: '2025-04-06',
      gastoReal: '248.50',
      detalles: [{ fecha: '2025-04-06', tiempo: 'ALMUERZO', platilloId: 'p1' }],
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Semana histórica guardada');
  });

  it('permite crear un platillo en línea y seguir capturando', async () => {
    const { cat, api, user } = abrir({
      catalogo: { listarPlatillos: vi.fn().mockResolvedValue(PAGINA_VACIA) },
    });
    fecha();
    await user.click(screen.getByRole('button', { name: 'Elegir Cena Lunes' }));
    await user.type(screen.getByLabelText('Buscar platillo'), 'Sopa de verduras');
    await user.click(screen.getByRole('button', { name: 'Crear «Sopa de verduras» y usar' }));
    expect(cat.crearPlatillo).toHaveBeenCalledWith({
      nombre: 'Sopa de verduras',
      tiempos: ['CENA'],
    });
    expect(await screen.findByText('Sopa de verduras')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(api.capturar).toHaveBeenCalledWith({
      fechaInicio: '2025-04-06',
      detalles: [{ fecha: '2025-04-07', tiempo: 'CENA', platilloId: 'p2' }],
    });
  });

  it('CA-15.2 pregunta antes de reemplazar y envía la versión confirmada', async () => {
    const capturar = vi
      .fn()
      .mockRejectedValueOnce(
        new ProblemaApi({
          status: 409,
          codigo: 'SEMANA_EXISTENTE',
          semana: { version: 3, gastoReal: '224.00' },
        }),
      )
      .mockResolvedValue({ id: 's1' });
    const { user } = abrir({ extra: { capturar } });
    fecha();
    await elegir(user);
    await user.type(screen.getByLabelText('Gasto semanal (Q), opcional'), '231.00');
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    const panel = await screen.findByRole('region', { name: 'Confirmar reemplazo' });
    expect(panel).toHaveTextContent('Q224.00');
    expect(capturar).toHaveBeenCalledTimes(1);
    await user.click(within(panel).getByRole('button', { name: 'Reemplazar semana' }));
    expect(capturar).toHaveBeenLastCalledWith(
      expect.objectContaining({ reemplazar: true, version: 3, gastoReal: '231.00' }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Semana histórica reemplazada');
  });

  it('cancelar el reemplazo conserva lo capturado y no vuelve a escribir', async () => {
    const capturar = vi
      .fn()
      .mockRejectedValue(
        new ProblemaApi({ status: 409, codigo: 'SEMANA_EXISTENTE', semana: { version: 1 } }),
      );
    const { user } = abrir({ extra: { capturar } });
    fecha();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar reemplazo' }));
    expect(screen.getByText('Pepián de pollo')).toBeInTheDocument();
    expect(capturar).toHaveBeenCalledTimes(1);
  });

  it('rechaza semanas sin platillos, gastos negativos y fechas no dominicales', async () => {
    const { api, user } = abrir();
    fecha();
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Registra al menos un platillo');
    await elegir(user);
    await user.type(screen.getByLabelText('Gasto semanal (Q), opcional'), '-50');
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(screen.getByRole('alert')).toHaveTextContent('El gasto debe ser un monto positivo');
    fecha('2025-04-07');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un domingo válido');
    expect(api.capturar).not.toHaveBeenCalled();
  });

  it('puede quitar un platillo elegido y muestra errores del servidor sin borrar la captura', async () => {
    const { user } = abrir({
      extra: { capturar: vi.fn().mockRejectedValue(ProblemaApi.sinConexion()) },
    });
    fecha();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: 'Quitar Almuerzo Domingo' }));
    expect(screen.queryByText('Pepián de pollo')).not.toBeInTheDocument();
    await elegir(user);
    await user.click(screen.getByRole('button', { name: 'Guardar semana histórica' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Necesitas conexión');
    expect(screen.getByText('Pepián de pollo')).toBeInTheDocument();
  });

  it('un miembro no puede abrir la captura', () => {
    const { api } = abrir({ rol: 'MIEMBRO' });
    expect(screen.getByRole('alert')).toHaveTextContent('Solo el administrador');
    expect(screen.queryByLabelText('Domingo de inicio')).not.toBeInTheDocument();
    expect(api.capturar).not.toHaveBeenCalled();
  });
});

describe('Consulta de historial', () => {
  it('muestra el historial vacío y permite filtrar fechas', async () => {
    const { api, user } = abrir({ lista: true });
    expect(await screen.findByText('No hay semanas históricas registradas.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-04-01' } });
    await user.click(screen.getByRole('button', { name: 'Filtrar' }));
    await waitFor(() =>
      expect(api.listar).toHaveBeenLastCalledWith({ desde: '2025-04-01', hasta: '', pagina: 1 }),
    );
  });
  it('muestra gasto y detalles, pagina y permite reintentar errores de carga', async () => {
    const respuesta = {
      datos: [
        {
          id: 's1',
          fechaInicio: '2025-04-06',
          fechaFin: '2025-04-12',
          gastoReal: '248.50',
          notas: 'Cuaderno familiar',
          detalles: [{ fecha: '2025-04-06', tiempo: 'ALMUERZO', nombre: 'Pepián de pollo' }],
        },
      ],
      paginacion: { pagina: 1, tamano: 20, total: 21, totalPaginas: 2 },
    };
    const listar = vi
      .fn()
      .mockRejectedValueOnce(ProblemaApi.sinConexion())
      .mockResolvedValue(respuesta);
    const { user } = abrir({ lista: true, extra: { listar } });
    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/Q248.50/)).toBeInTheDocument();
    await user.click(screen.getByText('Ver platillos de la semana'));
    expect(screen.getByText(/Pepián de pollo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(listar).toHaveBeenLastCalledWith({ desde: '', hasta: '', pagina: 2 }),
    );
  });
});
