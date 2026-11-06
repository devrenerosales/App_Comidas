import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { SeriePrecios } from '@menu/shared';
import type { ApiCatalogo, Producto } from '../api/catalogo';
import { ContextoApiCatalogo } from '../api/contexto-catalogo';
import { ContextoApiPrecios } from '../api/contexto-precios';
import type { ApiPrecios, HistoricoPrecios } from '../api/precios';
import { ProblemaApi } from '../api/problema';
import HistorialPrecios from './HistorialPrecios';

const POLLO = { id: 'p1', nombre: 'Pollo en piezas' } as Producto;

const sin = { porcentaje: null, texto: '—', tendencia: null } as const;

const WALMART: SeriePrecios = {
  supermercado: { id: 'walmart', nombre: 'Walmart' },
  puntos: [
    { fecha: '2026-10-10', precioNormalizado: '20.00', origen: 'AUTOMATICO' },
    { fecha: '2026-10-17', precioNormalizado: '21.00', origen: 'MANUAL' },
    { fecha: '2026-10-24', precioNormalizado: '22.00', origen: 'AUTOMATICO' },
  ],
  variacionAnterior: { porcentaje: 4.8, texto: '+4.8 %', tendencia: 'SUBE' },
  variacionPeriodo: { porcentaje: 10, texto: '+10.0 %', tendencia: 'SUBE' },
};
const PAIZ: SeriePrecios = {
  supermercado: { id: 'paiz', nombre: 'Paiz' },
  puntos: [
    { fecha: '2026-10-17', precioNormalizado: '7.00', origen: 'AUTOMATICO' },
    { fecha: '2026-10-24', precioNormalizado: '6.30', origen: 'TICKET' },
  ],
  variacionAnterior: { porcentaje: -10, texto: '−10.0 %', tendencia: 'BAJA' },
  variacionPeriodo: { porcentaje: -10, texto: '−10.0 %', tendencia: 'BAJA' },
};
const FRESH: SeriePrecios = {
  supermercado: { id: 'fresh', nombre: 'Super Fresh' },
  puntos: [{ fecha: '2026-10-24', precioNormalizado: '12.90', origen: 'MANUAL' }],
  variacionAnterior: sin,
  variacionPeriodo: sin,
};

function montar(respuesta: (semanas: number) => Promise<HistoricoPrecios> | HistoricoPrecios) {
  const precios = {
    historico: vi.fn().mockImplementation(async (_id: string, semanas = 12) => respuesta(semanas)),
  };
  const catalogo = { obtenerProducto: vi.fn().mockResolvedValue(POLLO) };
  render(
    <MemoryRouter initialEntries={['/platillos/productos/p1/historial-precios']}>
      <ContextoApiCatalogo.Provider value={catalogo as unknown as ApiCatalogo}>
        <ContextoApiPrecios.Provider value={precios as unknown as ApiPrecios}>
          <Route path="/platillos/productos/:id/historial-precios">
            <HistorialPrecios />
          </Route>
        </ContextoApiPrecios.Provider>
      </ContextoApiCatalogo.Provider>
    </MemoryRouter>,
  );
  return { precios, catalogo, user: userEvent.setup() };
}

describe('HU-37 Historial de precios', () => {
  it('CA-37.1 muestra las variaciones de cada supermercado con su indicador', async () => {
    const { precios } = montar((semanas) => ({
      productoId: 'p1',
      semanas: semanas as 12,
      series: [WALMART, PAIZ],
    }));
    const walmart = await screen.findByRole('region', { name: 'Walmart' });
    expect(walmart).toHaveTextContent('Vs. anterior: +4.8 % ▲ Subió');
    expect(walmart).toHaveTextContent('En el periodo: +10.0 % ▲ Subió');
    expect(precios.historico).toHaveBeenCalledWith('p1', 12);
    expect(
      (await screen.findAllByText('Historial de precios de Pollo en piezas')).length,
    ).toBeGreaterThan(0);
  });

  it('CA-37.2 una baja lleva el indicador de baja', async () => {
    montar(() => ({ productoId: 'p1', semanas: 12, series: [PAIZ] }));
    const paiz = await screen.findByRole('region', { name: 'Paiz' });
    expect(paiz).toHaveTextContent('Vs. anterior: −10.0 % ▼ Bajó');
  });

  it('CA-37.3 con un solo precio la variación es "—" sin indicador', async () => {
    montar(() => ({ productoId: 'p1', semanas: 12, series: [FRESH] }));
    const fresh = await screen.findByRole('region', { name: 'Super Fresh' });
    expect(fresh).toHaveTextContent('Vs. anterior: —');
    expect(fresh).toHaveTextContent('En el periodo: —');
    expect(fresh).not.toHaveTextContent('Subió');
    expect(fresh).not.toHaveTextContent('Bajó');
  });

  it('la tabla lista fecha, supermercado, precio y origen, lo más reciente primero', async () => {
    montar(() => ({ productoId: 'p1', semanas: 12, series: [WALMART, PAIZ] }));
    const tabla = await screen.findByRole('table', { name: 'Precios registrados' });
    const filas = within(tabla).getAllByRole('row').slice(1);
    expect(filas).toHaveLength(5);
    expect(filas[0]).toHaveTextContent('24/10/2026');
    expect(filas[0]).toHaveTextContent('Q22.00');
    expect(tabla).toHaveTextContent('Ticket');
    expect(tabla).toHaveTextContent('Manual');
    expect(tabla).toHaveTextContent('Automático');
    expect(screen.getByRole('img', { name: 'Gráfico de precios por supermercado' })).toBeVisible();
  });

  it('2a cambiar a 4 semanas vuelve a pedir el periodo', async () => {
    const { precios, user } = montar((semanas) => ({
      productoId: 'p1',
      semanas: semanas as 12,
      series: semanas === 4 ? [PAIZ] : [WALMART, PAIZ],
    }));
    await screen.findByRole('region', { name: 'Walmart' });
    await user.selectOptions(screen.getByLabelText('Periodo'), '4');
    await screen.findByRole('region', { name: 'Paiz' });
    expect(precios.historico).toHaveBeenLastCalledWith('p1', 4);
    expect(screen.queryByRole('region', { name: 'Walmart' })).not.toBeInTheDocument();
  });

  it('E1 sin precios dice que aún no hay precios', async () => {
    montar(() => ({ productoId: 'p1', semanas: 12, series: [] }));
    expect(await screen.findByText(/Aún no hay precios para este producto/)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('un error de la API se muestra con opción de reintentar', async () => {
    let intentos = 0;
    const { user } = montar(() => {
      intentos += 1;
      if (intentos === 1) {
        return Promise.reject(
          new ProblemaApi({ status: 500, codigo: 'ERROR', detail: 'Falló la consulta' }),
        );
      }
      return { productoId: 'p1', semanas: 12, series: [PAIZ] };
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló la consulta');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Paiz' })).toBeVisible();
  });
});
