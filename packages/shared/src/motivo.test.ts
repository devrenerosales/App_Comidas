import { describe, expect, it } from 'vitest';
import { factorPrincipal, resumenMotivo, type EntradaMotivo } from './motivo';

const PESOS = { preferencia: 0.4, novedad: 0.25, ahorro: 0.2, afinidad: 0.15 };
/** CA-22.1: Pollo en crema, 0.90 / 0.50 / 0.20 / 0.75. */
const POLLO = { preferencia: 0.9, novedad: 0.5, ahorro: 0.2, afinidad: 0.75 };

const entrada = (extra: Partial<EntradaMotivo> = {}): EntradaMotivo => ({
  origen: 'MOTOR',
  factores: POLLO,
  pesos: PESOS,
  costoIncompleto: false,
  ...extra,
});

describe('factorPrincipal', () => {
  it('elige el factor con mayor peso × valor (CA-22.1: preferencia aporta 0.36)', () => {
    expect(factorPrincipal(POLLO, PESOS, false)).toBe('preferencia');
  });

  it('con otros valores gana otro factor', () => {
    const f = { preferencia: 0.2, novedad: 1, ahorro: 0.1, afinidad: 0.1 };
    expect(factorPrincipal(f, PESOS, false)).toBe('novedad');
    expect(factorPrincipal({ ...f, novedad: 0, ahorro: 1 }, PESOS, false)).toBe('ahorro');
    expect(factorPrincipal({ ...f, novedad: 0, afinidad: 1 }, PESOS, false)).toBe('afinidad');
  });

  it('con costo incompleto el Ahorro neutro no puede ser la razón principal (D-18)', () => {
    const f = { preferencia: 0.1, novedad: 0.1, ahorro: 0.5, afinidad: 0.1 };
    expect(factorPrincipal(f, PESOS, false)).toBe('ahorro');
    expect(factorPrincipal(f, PESOS, true)).toBe('preferencia');
  });

  it('un empate lo gana el primero en el orden de los factores', () => {
    const f = { preferencia: 0.5, novedad: 0.8, ahorro: 0, afinidad: 0 };
    expect(factorPrincipal(f, { ...PESOS, preferencia: 0.4, novedad: 0.25 }, false)).toBe(
      'preferencia',
    );
  });

  it('si todos los aportes son cero no hay factor principal', () => {
    const ceros = { preferencia: 0, novedad: 0, ahorro: 0, afinidad: 0 };
    expect(factorPrincipal(ceros, PESOS, false)).toBeNull();
  });
});

describe('resumenMotivo', () => {
  it('CA-22.1 una sugerencia del motor nombra la razón principal', () => {
    expect(resumenMotivo(entrada())).toBe(
      'Sugerido sobre todo porque es de sus favoritos o está muy bien calificado',
    );
  });

  it('cada factor tiene su frase', () => {
    const solo = (k: keyof typeof POLLO) => ({
      preferencia: 0,
      novedad: 0,
      ahorro: 0,
      afinidad: 0,
      [k]: 1,
    });
    expect(resumenMotivo(entrada({ factores: solo('novedad') }))).toBe(
      'Sugerido sobre todo porque hace tiempo que no se prepara',
    );
    expect(resumenMotivo(entrada({ factores: solo('ahorro') }))).toBe(
      'Sugerido sobre todo porque cuesta menos',
    );
    expect(resumenMotivo(entrada({ factores: solo('afinidad') }))).toBe(
      'Sugerido sobre todo porque lo preparan seguido',
    );
  });

  it('CA-22.2 un platillo elegido por el usuario no lleva factores', () => {
    expect(resumenMotivo(entrada({ origen: 'USUARIO', factores: null, pesos: null }))).toBe(
      'Elegido por el usuario',
    );
  });

  it('CA-22.4 un reemplazo por presupuesto muestra la diferencia si se guardó', () => {
    expect(
      resumenMotivo(entrada({ origen: 'REEMPLAZO_PRESUPUESTO', nota: 'Q22.00 más barato' })),
    ).toBe('Reemplazo por presupuesto: Q22.00 más barato');
    expect(resumenMotivo(entrada({ origen: 'REEMPLAZO_PRESUPUESTO', nota: null }))).toBe(
      'Reemplazo por presupuesto',
    );
  });

  it('una alternativa pedida conserva su razón', () => {
    expect(resumenMotivo(entrada({ origen: 'ALTERNATIVA' }))).toBe(
      'Alternativa pedida. Sugerido sobre todo porque es de sus favoritos o está muy bien calificado',
    );
    expect(resumenMotivo(entrada({ origen: 'ALTERNATIVA', factores: null }))).toBe(
      'Alternativa pedida',
    );
  });

  it('un platillo del historial lo dice', () => {
    expect(resumenMotivo(entrada({ origen: 'HISTORICO', factores: null }))).toBe(
      'Platillo de una semana del historial',
    );
  });

  it('sin factores, sin pesos o sin factor principal usa una frase genérica', () => {
    expect(resumenMotivo(entrada({ factores: null }))).toBe('Sugerido por el motor');
    expect(resumenMotivo(entrada({ pesos: null }))).toBe('Sugerido por el motor');
    const ceros = { preferencia: 0, novedad: 0, ahorro: 0, afinidad: 0 };
    expect(resumenMotivo(entrada({ factores: ceros }))).toBe('Sugerido por el motor');
  });
});
