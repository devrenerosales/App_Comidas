import type { SemanaTablero } from '../api/tablero';
import {
  aNumero,
  construirGrafica,
  diasRestantes,
  fechaCorta,
  maximoRedondo,
  nivelMedidor,
  quetzales,
  resumenAhorro,
  ritmoDiario,
  trazoColumna,
} from './tablero';

const semana = (extra: Partial<SemanaTablero> = {}): SemanaTablero => ({
  id: 'm1',
  fechaInicio: '2026-11-01',
  fechaFin: '2026-11-07',
  estado: 'APROBADO',
  presupuesto: '250.00',
  costoEstimado: '230.00',
  gastoReal: '180.50',
  ...extra,
});

describe('formato', () => {
  it('convierte y formatea', () => {
    expect(aNumero('12.50')).toBe(12.5);
    expect(aNumero(null)).toBeNull();
    expect(aNumero('abc')).toBeNull();
    expect(quetzales(180.5)).toBe('Q180.50');
    expect(fechaCorta('2026-11-04')).toBe('04/11');
  });
});

describe('ritmo de gasto', () => {
  it('cuenta hoy entre los días que quedan', () => {
    expect(diasRestantes('2026-11-04', '2026-11-07')).toBe(4);
    expect(diasRestantes('2026-11-07', '2026-11-07')).toBe(1);
    expect(diasRestantes('2026-11-09', '2026-11-07')).toBe(1);
  });

  it('reparte lo que queda y no da negativos', () => {
    expect(ritmoDiario(69.5, 3)).toBe(23.17);
    expect(ritmoDiario(-10, 3)).toBe(0);
  });

  it.each([
    [100, 250, 'normal'],
    [212.5, 250, 'cerca'],
    [250, 250, 'cerca'],
    [250.01, 250, 'excede'],
    [10, 0, 'excede'],
  ])('gasto %d de %d → %s', (gasto, presupuesto, esperado) => {
    expect(nivelMedidor(gasto, presupuesto)).toBe(esperado);
  });
});

describe('resumenAhorro', () => {
  it('suma lo ahorrado solo en semanas con presupuesto y gasto', () => {
    const r = resumenAhorro([
      semana({ presupuesto: '250.00', gastoReal: '180.50' }),
      semana({ presupuesto: '200.00', gastoReal: '215.75' }),
      semana({ presupuesto: null, gastoReal: '90.00' }),
      semana({ presupuesto: '250.00', gastoReal: null }),
    ]);
    expect(r).toEqual({ ahorro: 53.75, semanas: 2, promedio: 198.13 });
  });

  it('sin semanas con datos no inventa promedio', () => {
    expect(resumenAhorro([])).toEqual({ ahorro: 0, semanas: 0, promedio: null });
  });
});

describe('maximoRedondo', () => {
  it.each([
    [0, 100],
    [180.5, 200],
    [250, 250],
    [251, 300],
    [262.4, 300],
    [47, 50],
    [1200, 1200],
    [1201, 1500],
  ])('%d → %d', (valor, esperado) => {
    expect(maximoRedondo(valor)).toBe(esperado);
  });
});

describe('construirGrafica', () => {
  const historial = [
    semana({ id: 'c', fechaInicio: '2026-11-01', gastoReal: '180.50' }),
    semana({ id: 'b', fechaInicio: '2026-10-25', presupuesto: '200.00', gastoReal: '215.75' }),
    semana({ id: 'a', fechaInicio: '2026-10-18', presupuesto: null, gastoReal: null }),
  ];

  it('ordena de la más antigua a la más reciente y marca la actual y las que exceden', () => {
    const g = construirGrafica(historial);
    expect(g.columnas.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(g.columnas.map((c) => c.actual)).toEqual([false, false, true]);
    expect(g.columnas.map((c) => c.excede)).toEqual([false, true, false]);
    expect(g.maximo).toBe(250);
  });

  it('una semana sin gasto no dibuja columna ni marca de presupuesto', () => {
    const [sinDatos] = construirGrafica(historial).columnas;
    expect(sinDatos?.alto).toBe(0);
    expect(sinDatos?.yPresupuesto).toBeNull();
  });

  it('las columnas crecen desde la base y no pasan de 24 px', () => {
    const g = construirGrafica(historial);
    const base = g.marcas[0]!.y;
    for (const c of g.columnas) {
      expect(c.ancho).toBeLessThanOrEqual(24);
      expect(c.y + c.alto).toBeCloseTo(base);
    }
    expect(g.marcas.map((m) => m.valor)).toEqual([0, 125, 250]);
  });

  it('sin semanas devuelve una gráfica vacía con eje de 100', () => {
    const g = construirGrafica([]);
    expect(g.columnas).toEqual([]);
    expect(g.maximo).toBe(100);
  });
});

describe('trazoColumna', () => {
  it('redondea solo las esquinas de arriba', () => {
    const d = trazoColumna(10, 20, 24, 80);
    expect(d.startsWith('M10,100')).toBe(true);
    expect(d).toContain('Q10,20 14,20');
    expect(d).toContain('Q34,20 34,24');
  });

  it('una columna sin alto no dibuja nada', () => {
    expect(trazoColumna(10, 20, 24, 0)).toBe('');
  });
});
