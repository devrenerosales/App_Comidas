import { IonApp } from '@ionic/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ContextoApiTablero } from '../api/contexto-tablero';
import type { ApiTablero, Tablero } from '../api/tablero';
import Inicio from './Inicio';

const SEMANA = {
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'APROBADO',
  presupuesto: '250.00',
  costoEstimado: '230.00',
  gastoReal: '180.50',
};

const TABLERO: Tablero = {
  hoy: '2026-11-04',
  semanaActual: {
    ...SEMANA,
    comidasPlanificadas: 21,
    comidasHastaHoy: 12,
    costoEstimadoHastaHoy: '131.25',
  },
  historial: [
    SEMANA,
    {
      ...SEMANA,
      id: 'm0',
      fechaInicio: '2026-10-25',
      fechaFin: '2026-10-31',
      estado: 'HISTORICO',
      presupuesto: '200.00',
      gastoReal: '215.75',
    },
    {
      ...SEMANA,
      id: 'mx',
      fechaInicio: '2026-10-18',
      fechaFin: '2026-10-24',
      estado: 'HISTORICO',
      presupuesto: null,
      gastoReal: null,
    },
  ],
};

function montar(obtener: ApiTablero['obtener']) {
  return render(
    <IonApp>
      <ContextoApiTablero.Provider value={{ obtener }}>
        <MemoryRouter>
          <Inicio />
        </MemoryRouter>
      </ContextoApiTablero.Provider>
    </IonApp>,
  );
}

describe('Inicio (tablero)', () => {
  it('muestra el gasto actual y las comidas al día de hoy', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    expect(await screen.findByText('Q180.50')).toBeInTheDocument();
    expect(screen.getByText(/de Q250.00 de presupuesto/)).toBeInTheDocument();
    expect(screen.getByText('12 de 21')).toBeInTheDocument();
    expect(screen.getByText(/costo estimado Q131.25/)).toBeInTheDocument();
  });

  it('lista el historial de presupuesto con su resultado', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    const lista = await screen.findByRole('list', { name: 'Historial de presupuesto' });
    expect(lista).toHaveTextContent('Presupuesto Q250.00 · Gasto Q180.50');
    expect(lista).toHaveTextContent('Dentro del presupuesto');
    expect(lista).toHaveTextContent('Excede por Q15.75');
    expect(lista).toHaveTextContent('Presupuesto — · Gasto —');
    expect(lista).toHaveTextContent('Sin gasto registrado');
  });

  it('sin gasto registrado ofrece registrarlo y muestra el costo estimado', async () => {
    montar(
      vi.fn().mockResolvedValue({
        ...TABLERO,
        semanaActual: { ...TABLERO.semanaActual!, gastoReal: null },
      }),
    );
    expect(await screen.findByText('Sin registrar')).toBeInTheDocument();
    expect(screen.getByText(/Costo estimado del menú: Q230.00/)).toBeInTheDocument();
  });

  it('sin menú esta semana lo indica y sin semanas dice que no hay historial', async () => {
    montar(vi.fn().mockResolvedValue({ hoy: '2026-11-04', semanaActual: null, historial: [] }));
    expect(await screen.findByText(/Todavía no hay un menú aprobado/)).toBeInTheDocument();
    expect(screen.getByText('Aún no hay semanas aprobadas.')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValue(TABLERO);
    montar(obtener);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Reintentar' }).click();
    expect(await screen.findByText('Q180.50')).toBeInTheDocument();
    expect(obtener).toHaveBeenCalledTimes(2);
  });
});
