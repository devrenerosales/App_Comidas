import { PESOS_MOTOR_POR_DEFECTO } from '@menu/shared';
import { construirCandidatos, costosPorPlatillo, ultimaFechaHistorial } from './menus.motor';
import type { PlatilloActivo, Preparacion } from './menus.repositorio';

const platillo = (id: string, extra: Partial<PlatilloActivo> = {}): PlatilloActivo => ({
  id,
  nombre: `Platillo ${id}`,
  proteina: 'POLLO',
  favorito: false,
  calificacionPromedio: null,
  tiempo: 'ALMUERZO',
  ...extra,
});
const prep = (platilloId: string, fecha: string, tiempo: Preparacion['tiempo'] = 'ALMUERZO') => ({
  platilloId,
  fecha,
  tiempo,
});
const base = {
  tiempo: 'ALMUERZO' as const,
  referencia: '2026-11-01',
  presupuestoPorComida: 35,
  pesos: PESOS_MOTOR_POR_DEFECTO,
  preparaciones: [] as Preparacion[],
};

describe('ultimaFechaHistorial', () => {
  it('es null sin historial y la fecha mayor con él', () => {
    expect(ultimaFechaHistorial([])).toBeNull();
    expect(
      ultimaFechaHistorial([
        prep('a', '2026-05-10'),
        prep('b', '2026-05-24'),
        prep('c', '2026-05-17'),
      ]),
    ).toBe('2026-05-24');
  });
});

describe('construirCandidatos (CU-05.1 paso 4)', () => {
  it('sin historial ni calificaciones: preferencia 0.50, novedad 1, ahorro neutro, afinidad 0', () => {
    const [c] = construirCandidatos({ ...base, platillos: [platillo('a')] });
    expect(c).toMatchObject({
      id: 'a',
      proteina: 'POLLO',
      costo: null,
      factores: { preferencia: 0.5, novedad: 1, ahorro: 0.5, afinidad: 0 },
    });
    // 0.40·0.5 + 0.25·1 + 0.20·0.5 + 0.15·0 = 0.55
    expect(c!.puntaje).toBe(0.55);
  });

  it('un favorito vale 1 y un promedio se normaliza de 1–5 a 0–1', () => {
    const r = construirCandidatos({
      ...base,
      platillos: [
        platillo('fav', { favorito: true }),
        platillo('cal', { calificacionPromedio: '4.60' }),
      ],
    });
    expect(r[0]!.factores.preferencia).toBe(1);
    expect(r[1]!.factores.preferencia).toBe(0.9);
  });

  it('novedad usa la última vez en cualquier tiempo; menos de 2 semanas vale 0 (RN-04)', () => {
    const r = construirCandidatos({
      ...base,
      platillos: [platillo('reciente'), platillo('hace4'), platillo('cena')],
      preparaciones: [
        prep('reciente', '2026-10-27'),
        prep('hace4', '2026-10-04'),
        prep('cena', '2026-10-27', 'CENA'),
      ],
    });
    expect(r.map((c) => c.factores.novedad)).toEqual([0, 0.5, 0]);
  });

  it('afinidad cuenta las veces en ese tiempo y se normaliza con el máximo entre candidatos', () => {
    const r = construirCandidatos({
      ...base,
      platillos: [platillo('a'), platillo('b'), platillo('c')],
      preparaciones: [
        prep('a', '2026-10-04'),
        prep('a', '2026-09-27'),
        prep('a', '2026-09-20'),
        prep('a', '2026-09-13'),
        prep('b', '2026-10-04'),
        prep('b', '2026-09-27'),
        prep('c', '2026-10-04', 'CENA'),
      ],
    });
    expect(r.map((c) => c.factores.afinidad)).toEqual([1, 0.5, 0]);
  });

  it('las preparaciones de hace más de 16 semanas no cuentan para la afinidad', () => {
    const [c] = construirCandidatos({
      ...base,
      platillos: [platillo('a')],
      preparaciones: [prep('a', '2026-06-01'), prep('a', '2026-10-04')],
    });
    // 2026-06-01 queda a 153 días (> 112) de la referencia: solo cuenta la de octubre.
    expect(c!.factores.afinidad).toBe(1);
  });

  it('el costo incompleto da ahorro neutro aunque el presupuesto por comida sea alto', () => {
    const [c] = construirCandidatos({
      ...base,
      presupuestoPorComida: 500,
      platillos: [platillo('a')],
    });
    expect(c!.factores.ahorro).toBe(0.5);
  });

  it('sin platillos devuelve una lista vacía', () => {
    expect(construirCandidatos({ ...base, platillos: [] })).toEqual([]);
  });

  it('con costos conocidos el candidato lo lleva y el Ahorro sale de él', () => {
    // Presupuesto por comida 35: un platillo de Q14 ahorra 0.60 y uno de Q70 ahorra 0.
    const [barato, caro, sinCosto] = construirCandidatos({
      ...base,
      platillos: [platillo('barato'), platillo('caro'), platillo('sin')],
      costos: new Map<string, number | null>([
        ['barato', 14],
        ['caro', 70],
        ['sin', null],
      ]),
    });
    expect(barato).toMatchObject({ costo: 14, factores: { ahorro: 0.6 } });
    expect(caro).toMatchObject({ costo: 70, factores: { ahorro: 0 } });
    expect(sinCosto).toMatchObject({ costo: null, factores: { ahorro: 0.5 } });
  });
});

describe('costosPorPlatillo (CU-05.3 paso 2)', () => {
  const lb = { codigo: 'lb', magnitud: 'MASA' as const, factorBase: 453.592 };
  const datos = (precio: number | null) => ({
    porcionesBase: 4,
    ingredientes: [
      {
        cantidad: 2,
        unidad: lb,
        presentacion: { cantidad: 5, unidad: lb },
        equivalencia: null,
        precioMediana: precio,
      },
    ],
  });

  it('escala por la Σ de factores del hogar y usa el precio mediana', () => {
    // 2 lb para 4 porciones con Σ 2.5 → 1.25 lb de una bolsa de 5 lb a Q50 → Q12.50.
    const costos = costosPorPlatillo(['a'], new Map([['a', datos(50)]]), 2.5);
    expect(costos.get('a')).toBe(12.5);
  });

  it('sin ingredientes o con un ingrediente sin precio el costo es incompleto (null)', () => {
    const costos = costosPorPlatillo(
      ['sinIngredientes', 'sinPrecio', 'completo'],
      new Map([
        ['sinPrecio', datos(null)],
        ['completo', datos(50)],
      ]),
      4,
    );
    expect(costos.get('sinIngredientes')).toBeNull();
    expect(costos.get('sinPrecio')).toBeNull();
    expect(costos.get('completo')).toBe(20);
  });
});
