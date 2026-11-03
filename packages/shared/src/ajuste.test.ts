import { describe, expect, it } from 'vitest';
import type { ProteinaPrincipal, UnidadMedida } from './catalogo';
import {
  ALTERNATIVAS_POR_DIA,
  INTENTOS_AJUSTE,
  ajustarPresupuesto,
  costoDePlatillo,
  type EspacioAjuste,
  type IngredienteCosto,
} from './ajuste';
import type { CandidatoMotor } from './motor';

const FACTORES = { preferencia: 0.5, novedad: 0.5, ahorro: 0.5, afinidad: 0.5 };
const plato = (
  id: string,
  costo: number | null,
  puntaje = 0.5,
  proteina: ProteinaPrincipal = 'OTRA',
): CandidatoMotor => ({ id, nombre: id, proteina, puntaje, factores: FACTORES, costo });

const DIAS = [
  '2026-11-01',
  '2026-11-02',
  '2026-11-03',
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
];
const semana = (platos: CandidatoMotor[], fijados: number[] = []): EspacioAjuste[] =>
  platos.map((candidato, i) => ({ fecha: DIAS[i]!, candidato, fijado: fijados.includes(i) }));

const lb: UnidadMedida = { codigo: 'lb', magnitud: 'MASA', factorBase: 453.592 };
const g: UnidadMedida = { codigo: 'g', magnitud: 'MASA', factorBase: 1 };
const taza: UnidadMedida = { codigo: 'taza', magnitud: 'VOLUMEN', factorBase: 240 };

describe('costoDePlatillo (CU-05.3 paso 2, RN-07, D-02)', () => {
  const pollo = (extra: Partial<IngredienteCosto> = {}): IngredienteCosto => ({
    cantidad: 2,
    unidad: lb,
    presentacion: { cantidad: 5, unidad: lb },
    equivalencia: null,
    precioMediana: 50,
    ...extra,
  });

  it('escala por Σ factores ÷ porciones base y multiplica por el precio de la presentación', () => {
    // 2 lb para 4 porciones con Σ 2.5 → 1.25 lb de una bolsa de 5 lb a Q50 → Q12.50.
    expect(costoDePlatillo([pollo()], 4, 2.5)).toEqual({ costo: 12.5, incompleto: false });
  });

  it('convierte entre unidades de la misma magnitud', () => {
    const gramos = pollo({ cantidad: 500, unidad: g });
    // 500 g × (4 ÷ 4) = 500 g = 1.1023 lb de 5 lb a Q50 → Q11.02.
    expect(costoDePlatillo([gramos], 4, 4).costo).toBe(11.02);
  });

  it('usa la equivalencia cuando la unidad es de otra magnitud (taza de arroz → lb)', () => {
    const arroz = pollo({ cantidad: 2, unidad: taza, equivalencia: 0.5 });
    // 2 tazas × 0.5 lb = 1 lb de 5 lb a Q50 → Q10.
    expect(costoDePlatillo([arroz], 4, 4)).toEqual({ costo: 10, incompleto: false });
  });

  describe('respaldo con el promedio de compra (RN-08, RN-12, CA-44.4)', () => {
    // 2 lb × (4 ÷ 4) = 2 lb de una bolsa de 5 lb: el 40 % del precio de la bolsa.
    it('con precio vigente usa el de mercado y no el promedio de compra', () => {
      const r = costoDePlatillo([pollo({ precioMediana: 50, precioDeCompra: 30 })], 4, 4);
      expect(r).toEqual({ costo: 20, incompleto: false });
    });

    it('sin precio vigente (desactualizado) usa el promedio de compra y lo indica', () => {
      const r = costoDePlatillo(
        [pollo({ precioMediana: 50, precioDesactualizado: true, precioDeCompra: 30 })],
        4,
        4,
      );
      expect(r).toEqual({ costo: 12, incompleto: false, conPrecioDeCompra: true });
    });

    it('sin ningún precio de mercado usa el promedio de compra', () => {
      const r = costoDePlatillo([pollo({ precioMediana: null, precioDeCompra: '8.75' })], 4, 4);
      expect(r).toEqual({ costo: 3.5, incompleto: false, conPrecioDeCompra: true });
    });

    it('desactualizado y sin promedio usa el último precio conocido sin la marca', () => {
      const r = costoDePlatillo([pollo({ precioMediana: 50, precioDesactualizado: true })], 4, 4);
      expect(r).toEqual({ costo: 20, incompleto: false });
      const r2 = costoDePlatillo(
        [pollo({ precioMediana: 50, precioDesactualizado: true, precioDeCompra: null })],
        4,
        4,
      );
      expect(r2).toEqual({ costo: 20, incompleto: false });
    });

    it('sin precio de mercado ni promedio el costo queda incompleto', () => {
      expect(costoDePlatillo([pollo({ precioMediana: null })], 4, 4)).toEqual({
        costo: 0,
        incompleto: true,
      });
    });
  });

  it('suma varios ingredientes', () => {
    expect(costoDePlatillo([pollo(), pollo({ precioMediana: 25 })], 4, 4).costo).toBe(30);
  });

  it('un ingrediente sin precio aporta Q0.00 y marca el platillo incompleto', () => {
    expect(costoDePlatillo([pollo(), pollo({ precioMediana: null })], 4, 4)).toEqual({
      costo: 20,
      incompleto: true,
    });
  });

  it('una unidad que no se puede convertir marca el platillo incompleto', () => {
    const manojo: UnidadMedida = { codigo: 'manojo', magnitud: 'CONTEO', factorBase: null };
    expect(costoDePlatillo([pollo({ unidad: manojo })], 4, 4)).toEqual({
      costo: 0,
      incompleto: true,
    });
  });

  it('una presentación sin contenido no se puede costear', () => {
    const roto = pollo({ presentacion: { cantidad: 0, unidad: lb } });
    expect(costoDePlatillo([roto], 4, 4).incompleto).toBe(true);
  });

  it('un platillo sin ingredientes es incompleto con costo 0', () => {
    expect(costoDePlatillo([], 4, 4)).toEqual({ costo: 0, incompleto: true });
  });
});

describe('ajustarPresupuesto (CU-05.3, RN-05, HU-21)', () => {
  it('CA-21.1 un menú que cumple no hace reemplazos y deja Q15.50 disponibles', () => {
    const platos = [30, 32, 33.5, 31, 34, 35, 34].map((c, i) => plato(`p${i}`, c));
    const r = ajustarPresupuesto({
      presupuesto: 245,
      espacios: semana(platos),
      candidatos: [...platos, plato('barato', 10, 0.99)],
    });
    expect(r.reemplazos).toEqual([]);
    expect(r.intentos).toBe(0);
    expect(r.costo).toBe(229.5);
    expect(r.exceso).toBe(0);
    expect(r.alternativas).toEqual([]);
    expect(245 - r.costo).toBe(15.5);
  });

  it('CA-21.2 un menú excedido se corrige en 2 intentos reemplazando los más caros', () => {
    const resto = [40, 38, 37, 36, 36].map((c, i) => plato(`r${i}`, c));
    const pepian = plato('pepian', 48);
    const caldo = plato('caldo', 45);
    const tortitas = plato('tortitas', 26, 0.8);
    const spaghetti = plato('spaghetti', 30, 0.7);
    const platos = [pepian, ...resto.slice(0, 2), caldo, ...resto.slice(2)];
    const r = ajustarPresupuesto({
      presupuesto: 250,
      espacios: semana(platos),
      candidatos: [...platos, tortitas, spaghetti],
    });
    expect(r.reemplazos.map((x) => [x.de.id, x.a.id, x.ahorro])).toEqual([
      ['pepian', 'tortitas', 22],
      ['caldo', 'spaghetti', 15],
    ]);
    expect(r.intentos).toBe(2);
    expect(r.costo).toBe(243);
    expect(r.exceso).toBe(0);
    expect(r.espacios[0]!.candidato!.id).toBe('tortitas');
    expect(r.espacios[3]!.candidato!.id).toBe('spaghetti');
  });

  describe('CA-21.3 presupuesto insuficiente', () => {
    const base = [50, 48, 45, 35, 34, 34, 34].map((c, i) => plato(`p${i}`, c));
    const reservas = [
      plato('a', 20, 0.9),
      plato('b', 18, 0.8),
      plato('c', 30, 0.7),
      plato('e', 32, 0.5),
      plato('f', 31, 0.4),
      plato('g', 30, 0.3),
      plato('h', 29, 0.2),
    ];
    const r = ajustarPresupuesto({
      presupuesto: 150,
      espacios: semana(base),
      candidatos: [...base, ...reservas],
    });

    it('hace 3 reemplazos, queda en Q205.00 y excede por Q55.00', () => {
      expect(r.intentos).toBe(INTENTOS_AJUSTE);
      expect(r.reemplazos).toHaveLength(3);
      expect(r.costo).toBe(205);
      expect(r.exceso).toBe(55);
    });

    it('ofrece hasta 3 alternativas más baratas por día, por puntaje', () => {
      const dia = (fecha: string) => r.alternativas.find((a) => a.fecha === fecha);
      expect(dia(DIAS[3]!)!.platillos.map((p) => p.id)).toEqual(['e', 'f', 'g']);
      expect(dia(DIAS[3]!)!.platillos).toHaveLength(ALTERNATIVAS_POR_DIA);
      expect(dia(DIAS[2]!)!.platillos.map((p) => p.id)).toEqual(['h']);
      expect(dia(DIAS[0]!)).toBeUndefined();
    });
  });

  it('E2 si el más caro no tiene reemplazo válido, el intento se pierde y pasa al siguiente', () => {
    const p = plato('p', 60, 0.5, 'RES');
    const q = plato('q', 50, 0.5, 'POLLO');
    const s = plato('s', 40, 0.5);
    const r = plato('r', 45, 0.9, 'POLLO');
    const res = ajustarPresupuesto({
      presupuesto: 140,
      espacios: semana([p, q, s]),
      // r repite la proteína de q, el vecino del día de p (RN-02): no vale para p pero sí para q.
      candidatos: [p, q, s, r],
    });
    expect(res.reemplazos.map((x) => [x.fecha, x.de.id, x.a.id])).toEqual([[DIAS[1], 'q', 'r']]);
    expect(res.intentos).toBe(3);
    expect(res.costo).toBe(145);
    expect(res.exceso).toBe(5);
  });

  it('RN-03: no reemplaza por un platillo que ya está en la semana', () => {
    const platos = [plato('a', 60), plato('b', 50)];
    const res = ajustarPresupuesto({
      presupuesto: 10,
      espacios: semana(platos),
      candidatos: platos,
    });
    expect(res.reemplazos).toEqual([]);
    expect(res.intentos).toBe(2);
  });

  it('RN-02: no reemplaza por una proteína igual a la del día anterior o siguiente', () => {
    const a = plato('a', 60, 0.5, 'RES');
    const b = plato('b', 10, 0.5, 'POLLO');
    const barato = plato('barato', 20, 0.9, 'POLLO');
    const res = ajustarPresupuesto({
      presupuesto: 30,
      espacios: semana([a, b]),
      candidatos: [a, b, barato],
    });
    // barato (pollo) choca con b (pollo), vecino de a; no se asigna.
    expect(res.reemplazos).toEqual([]);
  });

  it('los espacios fijados nunca se reemplazan', () => {
    const caro = plato('caro', 100);
    const medio = plato('medio', 50);
    const barato = plato('barato', 10, 0.9);
    const res = ajustarPresupuesto({
      presupuesto: 120,
      espacios: semana([caro, medio], [0]),
      candidatos: [caro, medio, barato],
    });
    expect(res.espacios[0]!.candidato!.id).toBe('caro');
    expect(res.reemplazos.map((x) => x.de.id)).toEqual(['medio']);
    expect(res.costo).toBe(110);
  });

  it('un platillo sin costo conocido aporta Q0.00, marca incompleto y no se reemplaza', () => {
    const desconocido = plato('desconocido', null);
    const conocido = plato('conocido', 80);
    const res = ajustarPresupuesto({
      presupuesto: 50,
      espacios: semana([desconocido, conocido]),
      candidatos: [desconocido, conocido, plato('barato', 20, 0.9), plato('sin', null, 0.99)],
    });
    expect(res.incompleto).toBe(true);
    expect(res.espacios[0]!.candidato!.id).toBe('desconocido');
    expect(res.reemplazos.map((x) => [x.de.id, x.a.id])).toEqual([['conocido', 'barato']]);
    expect(res.costo).toBe(20);
  });

  it('un espacio sin sugerencia no cuenta y no rompe el ajuste', () => {
    const espacios: EspacioAjuste[] = [
      { fecha: DIAS[0]!, candidato: null, fijado: false },
      { fecha: DIAS[1]!, candidato: plato('a', 90), fijado: false },
    ];
    const res = ajustarPresupuesto({
      presupuesto: 50,
      espacios,
      candidatos: [plato('a', 90), plato('b', 40, 0.9)],
    });
    expect(res.reemplazos.map((x) => x.a.id)).toEqual(['b']);
    expect(res.incompleto).toBe(false);
    expect(res.espacios[0]!.candidato).toBeNull();
  });

  it('sin platillos reemplazables el ajuste termina sin intentos', () => {
    const res = ajustarPresupuesto({
      presupuesto: 10,
      espacios: semana([plato('a', 100)], [0]),
      candidatos: [plato('a', 100)],
    });
    expect(res.intentos).toBe(0);
    expect(res.exceso).toBe(90);
    expect(res.alternativas).toEqual([]);
  });
});
