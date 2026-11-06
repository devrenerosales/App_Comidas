import { IonApp } from '@ionic/react';
import { render, screen, within } from '@testing-library/react';
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
    comidasDeHoy: [
      { tiempo: 'DESAYUNO', platillo: 'Huevos con frijol', costoEstimado: '12.00' },
      { tiempo: 'ALMUERZO', platillo: null, costoEstimado: null },
      { tiempo: 'CENA', platillo: 'Pepián de pollo', costoEstimado: '38.50' },
    ],
    tiempos: [
      { tiempo: 'DESAYUNO', presupuesto: '50.00', costoEstimado: '45.00' },
      { tiempo: 'ALMUERZO', presupuesto: '120.00', costoEstimado: '130.00' },
      { tiempo: 'CENA', presupuesto: '80.00', costoEstimado: null },
    ],
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
  it('la cifra principal es el gasto frente al presupuesto, con el medidor y su estado', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    const principal = await screen.findByRole('region', { name: 'Gasto de la semana' });
    expect(within(principal).getByText('Q180.50')).toBeInTheDocument();
    expect(screen.getByText(/de Q250.00 de presupuesto · 72 %/)).toBeInTheDocument();
    const medidor = screen.getByRole('meter', { name: 'Gasto frente al presupuesto' });
    expect(medidor).toHaveAttribute('aria-valuenow', '180.5');
    expect(medidor).toHaveAttribute('aria-valuemax', '250');
    expect(screen.getByText('Vas dentro del presupuesto')).toBeInTheDocument();
  });

  it('las tarjetas muestran lo que queda, el ritmo por día y el ahorro acumulado', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    const resumen = await screen.findByLabelText('Resumen de la semana');
    expect(within(resumen).getByText('Te quedan')).toBeInTheDocument();
    expect(within(resumen).getByText('Q69.50')).toBeInTheDocument();
    // 69.50 entre los 4 días que quedan (del 4 al 7 de noviembre).
    expect(within(resumen).getByText('Q17.38')).toBeInTheDocument();
    expect(within(resumen).getByText('4 días restantes')).toBeInTheDocument();
    // Solo la semana con presupuesto y gasto cuenta: (250 − 180.50) + (200 − 215.75) = 53.75.
    expect(within(resumen).getByText('+Q53.75')).toBeInTheDocument();
    expect(within(resumen).getByText('en 2 semanas')).toBeInTheDocument();
  });

  it('si se pasa del presupuesto lo dice y lo marca en el medidor', async () => {
    montar(
      vi.fn().mockResolvedValue({
        ...TABLERO,
        semanaActual: { ...TABLERO.semanaActual!, gastoReal: '275.00' },
      }),
    );
    expect(await screen.findByText('Superaste el presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Te pasaste')).toBeInTheDocument();
    expect(screen.getByText('Q25.00')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Gasto frente al presupuesto' })).toHaveClass(
      'mf-medidor--excede',
    );
  });

  it('Hoy lista las comidas del día y cuántas de la semana ya pasaron', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    const hoy = await screen.findByRole('list', { name: 'Comidas de hoy' });
    expect(within(hoy).getByText('Huevos con frijol')).toBeInTheDocument();
    expect(within(hoy).getByText('Pepián de pollo')).toBeInTheDocument();
    expect(within(hoy).getByText('Sin sugerencia')).toBeInTheDocument();
    expect(within(hoy).getByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('12 de 21')).toBeInTheDocument();
    expect(screen.getByText(/costo estimado Q131.25/)).toBeInTheDocument();
  });

  it('el costo por tiempo de comida marca el que excede su presupuesto', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    const lista = await screen.findByRole('list', {
      name: 'Costo estimado por tiempo de comida',
    });
    expect(lista).toHaveTextContent('Q45.00 de Q50.00');
    expect(lista).toHaveTextContent('Q130.00 de Q120.00');
    expect(
      within(lista).getByRole('meter', { name: 'Almuerzo: costo frente a su presupuesto' }),
    ).toHaveClass('mf-medidor--excede');
    // La cena aún no tiene costo: sin medidor.
    expect(within(lista).queryByRole('meter', { name: /Cena/ })).not.toBeInTheDocument();
  });

  it('la gráfica describe cada semana y el detalle repite los datos en lista', async () => {
    montar(vi.fn().mockResolvedValue(TABLERO));
    expect(
      await screen.findByRole('img', {
        name: 'Semana del 25/10: gasto Q215.75, presupuesto Q200.00, excedió',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Semana del 18/10: sin gasto registrado, sin presupuesto' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Excedió')).toBeInTheDocument();

    const lista = screen.getByRole('list', { name: 'Historial de presupuesto' });
    expect(lista).toHaveTextContent('Presupuesto Q250.00 · Gasto Q180.50');
    expect(lista).toHaveTextContent('Dentro del presupuesto');
    expect(lista).toHaveTextContent('Excede por Q15.75');
    expect(lista).toHaveTextContent('Presupuesto — · Gasto —');
    expect(lista).toHaveTextContent('Sin gasto registrado');
    expect(screen.getByText('Q198.13')).toBeInTheDocument();
  });

  it('sin gasto registrado muestra el costo estimado como referencia y ofrece registrarlo', async () => {
    montar(
      vi.fn().mockResolvedValue({
        ...TABLERO,
        semanaActual: { ...TABLERO.semanaActual!, gastoReal: null },
      }),
    );
    expect(await screen.findByText('Costo estimado del menú')).toBeInTheDocument();
    expect(screen.getByText('Q230.00')).toBeInTheDocument();
    expect(screen.getByText(/Aún no registras el gasto real/)).toBeInTheDocument();
  });

  it('sin menú esta semana lo indica y sin semanas dice que no hay historial', async () => {
    montar(vi.fn().mockResolvedValue({ hoy: '2026-11-04', semanaActual: null, historial: [] }));
    expect(await screen.findByText(/Todavía no hay un menú aprobado/)).toBeInTheDocument();
    expect(screen.getByText('Aún no hay semanas aprobadas.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Resumen de la semana')).not.toBeInTheDocument();
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValue(TABLERO);
    montar(obtener);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    screen.getByRole('button', { name: 'Reintentar' }).click();
    expect(await screen.findByRole('region', { name: 'Gasto de la semana' })).toBeInTheDocument();
    expect(obtener).toHaveBeenCalledTimes(2);
  });
});
