import { describe, expect, it } from 'vitest';
import { ORDEN_TIEMPOS, TiempoComida } from './enums';
import { distribucionPorDefecto } from './presupuesto';

const { DESAYUNO, ALMUERZO, CENA } = TiempoComida;

const suma = (d: Record<string, number | undefined>) =>
  Object.values(d).reduce<number>((acc, v) => acc + (v ?? 0), 0);

describe('distribucionPorDefecto (RN-06)', () => {
  it.each([
    [[ALMUERZO], { ALMUERZO: 100 }],
    [[ALMUERZO, CENA], { ALMUERZO: 60, CENA: 40 }],
    [[DESAYUNO, ALMUERZO], { DESAYUNO: 29, ALMUERZO: 71 }],
    [[DESAYUNO, CENA], { DESAYUNO: 40, CENA: 60 }],
    [[DESAYUNO, ALMUERZO, CENA], { DESAYUNO: 20, ALMUERZO: 50, CENA: 30 }],
  ] as const)('%j → %j', (tiempos, esperado) => {
    const resultado = distribucionPorDefecto(tiempos);
    expect(resultado).toEqual(esperado);
    expect(suma(resultado)).toBe(100);
  });

  it('ignora el orden de entrada', () => {
    expect(distribucionPorDefecto([CENA, ALMUERZO, DESAYUNO])).toEqual({
      DESAYUNO: 20,
      ALMUERZO: 50,
      CENA: 30,
    });
  });

  it('ignora tiempos duplicados', () => {
    expect(distribucionPorDefecto([ALMUERZO, ALMUERZO, CENA])).toEqual({ ALMUERZO: 60, CENA: 40 });
  });

  it('devuelve una copia que no altera la tabla interna', () => {
    const d = distribucionPorDefecto([ALMUERZO]);
    d.ALMUERZO = 1;
    expect(distribucionPorDefecto([ALMUERZO])).toEqual({ ALMUERZO: 100 });
  });

  it.each([[[]], [[DESAYUNO]], [[CENA]]] as const)('lanza error para %j', (tiempos) => {
    expect(() => distribucionPorDefecto(tiempos)).toThrow(RangeError);
  });

  it('el mensaje indica combinación vacía', () => {
    expect(() => distribucionPorDefecto([])).toThrow(/vacía/);
  });

  it('ORDEN_TIEMPOS sigue el orden del día', () => {
    expect(ORDEN_TIEMPOS).toEqual([DESAYUNO, ALMUERZO, CENA]);
  });
});
