import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextoAuth, type ValorAuth } from '../auth/contexto';
import { ContextoApiHistorial } from '../api/contexto-historial';
import type { ApiHistorial, SemanaHistorica } from '../api/historial';
import { ProblemaApi } from '../api/problema';
import { ID_PLATILLO, PLATILLO, apiCatalogoFalsa } from '../test/catalogo-datos';
import { renderizarCatalogo } from '../test/catalogo';
import Historial from './Historial';

type Detalle = SemanaHistorica['detalles'][number];
/** El API puede devolver `platilloId: null` (espacio vacío) aunque el tipo web lo declare texto. */
type DatosDetalle = Partial<Omit<Detalle, 'platilloId'>> & { platilloId?: string | null };
const detalle = (extra: DatosDetalle): Detalle =>
  ({
    id: 'd1',
    fecha: '2026-11-10',
    tiempo: 'ALMUERZO',
    platilloId: 'p1',
    nombre: 'Pollo en crema',
    calificacion: null,
    ...extra,
  }) as Detalle;
const semana = (detalles: Detalle[]): SemanaHistorica => ({
  id: 's1',
  fechaInicio: '2026-11-08',
  fechaFin: '2026-11-14',
  estado: 'HISTORICO',
  origen: 'CAPTURA_MANUAL',
  gastoReal: null,
  notas: null,
  version: 1,
  detalles,
});

async function abrir(
  detalles: Detalle[],
  extra: Partial<Record<keyof ApiHistorial, unknown>> = {},
) {
  const api = {
    listar: vi.fn().mockResolvedValue({
      datos: [semana(detalles)],
      paginacion: { pagina: 1, tamano: 20, total: 1, totalPaginas: 1 },
    }),
    capturar: vi.fn(),
    calificar: vi.fn().mockResolvedValue({
      valor: 4,
      platillo: { id: 'p1', calificacionPromedio: '4.00', calificacionConteo: 1 },
    }),
    ...extra,
  };
  render(
    <MemoryRouter initialEntries={['/historial']}>
      <ContextoAuth.Provider value={{ hogar: { id: 'h1', rol: 'MIEMBRO' } } as ValorAuth}>
        <ContextoApiHistorial.Provider value={api as unknown as ApiHistorial}>
          <Historial />
        </ContextoApiHistorial.Provider>
      </ContextoAuth.Provider>
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByText('Ver platillos de la semana'));
  return { api, user };
}

describe('HU-14 Calificar platillo desde el historial', () => {
  beforeEach(() => {
    // Hoy es jueves 2026-11-12 (hora de Guatemala), igual que los criterios.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-12T15:00:00Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('CA-14.1 califica un almuerzo ya comido con 4 estrellas', async () => {
    const { api, user } = await abrir([detalle({})]);
    const grupo = screen.getByRole('group', {
      name: 'Calificación de Pollo en crema del 2026-11-10',
    });
    await user.click(within(grupo).getByRole('button', { name: '4 estrellas' }));
    await waitFor(() => expect(api.calificar).toHaveBeenCalledWith('s1', 'd1', 4));
    expect(
      await screen.findByText('Calificación guardada: 4 de 5 para Pollo en crema. Promedio: 4.00.'),
    ).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: '4 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(grupo).getByRole('button', { name: '5 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('CA-14.2 muestra la calificación actual y permite cambiarla', async () => {
    const { api, user } = await abrir([detalle({ calificacion: 3 })], {
      calificar: vi.fn().mockResolvedValue({
        valor: 5,
        platillo: { id: 'p1', calificacionPromedio: '5.00', calificacionConteo: 2 },
      }),
    });
    const grupo = screen.getByRole('group', { name: /Calificación de Pollo en crema/ });
    expect(within(grupo).getByRole('button', { name: '3 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(grupo).getByRole('button', { name: '5 estrellas' }));
    await waitFor(() => expect(api.calificar).toHaveBeenCalledWith('s1', 'd1', 5));
    expect(await screen.findByText(/Promedio: 5.00/)).toBeInTheDocument();
    expect(within(grupo).getByRole('button', { name: '5 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('CA-14.3 una comida futura no ofrece calificar; la de hoy sí', async () => {
    await abrir([
      detalle({ id: 'd2', fecha: '2026-11-14', nombre: 'Spaghetti con carne' }),
      detalle({ id: 'd3', fecha: '2026-11-12', nombre: 'Caldo de res' }),
    ]);
    expect(screen.queryByRole('group', { name: /Spaghetti con carne/ })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Caldo de res/ })).toBeInTheDocument();
  });

  it('un espacio sin platillo no se puede calificar', async () => {
    await abrir([detalle({ platilloId: null, nombre: null })]);
    expect(screen.getByText(/Sin platillo/)).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Calificación/ })).not.toBeInTheDocument();
  });

  it('si el platillo aún no tiene promedio el aviso no lo menciona', async () => {
    const { user } = await abrir([detalle({})], {
      calificar: vi.fn().mockResolvedValue({
        valor: 2,
        platillo: { id: 'p1', calificacionPromedio: null, calificacionConteo: 0 },
      }),
    });
    await user.click(screen.getByRole('button', { name: '2 estrellas' }));
    expect(
      await screen.findByText('Calificación guardada: 2 de 5 para Pollo en crema.'),
    ).toBeInTheDocument();
  });

  it('un error al calificar se muestra y no cambia la calificación', async () => {
    const { user } = await abrir([detalle({ calificacion: 3 })], {
      calificar: vi.fn().mockRejectedValue(
        new ProblemaApi({
          status: 422,
          codigo: 'FECHA_FUTURA',
          detail: 'Solo puedes calificar comidas de hoy o anteriores.',
        }),
      ),
    });
    await user.click(screen.getByRole('button', { name: '5 estrellas' }));
    expect(
      await screen.findByText('Solo puedes calificar comidas de hoy o anteriores.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 estrellas' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('HU-14 Promedio en el catálogo', () => {
  it('la lista de platillos muestra el promedio con estrella', async () => {
    const api = apiCatalogoFalsa({
      listarPlatillos: vi.fn().mockResolvedValue({
        datos: [{ ...PLATILLO, calificacionPromedio: '4.50' }],
        paginacion: { pagina: 1, tamano: 100, total: 1, totalPaginas: 1 },
      }),
    });
    renderizarCatalogo('/platillos', api);
    expect(await screen.findByLabelText('Calificación promedio 4.50')).toHaveTextContent('★ 4.50');
  });

  it('el detalle del platillo muestra el promedio y sin calificaciones no muestra nada', async () => {
    const api = apiCatalogoFalsa({
      obtenerPlatillo: vi.fn().mockResolvedValue({ ...PLATILLO, calificacionPromedio: '4.50' }),
    });
    renderizarCatalogo(`/platillos/${ID_PLATILLO}`, api);
    expect(await screen.findByLabelText('Calificación promedio 4.50')).toBeInTheDocument();
  });
});
