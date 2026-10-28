import { describe, expect, it } from 'vitest';
import {
  FACTOR_PORCION_SUGERIDO,
  MENSAJES_COMENSALES,
  esFactorPorcionValido,
  formatearFactor,
  leerFactorPorcion,
  limpiarNombreComensal,
  mostrarFactor,
  normalizarNombreComensal,
  pasoFactor,
  totalPorciones,
} from './comensales';

describe('totalPorciones (RN-07, D-02)', () => {
  it('CA-03.1 Rene, Ana y Diego con 1.0 más Abuela Carmen con el sugerido suman 4.0', () => {
    const familia = [
      { factorPorcion: '1.00' },
      { factorPorcion: '1.00' },
      { factorPorcion: '1.00' },
      { factorPorcion: FACTOR_PORCION_SUGERIDO },
    ];
    expect(totalPorciones(familia)).toBe(4);
  });

  it('CA-03.2 los comensales inactivos no cuentan', () => {
    expect(
      totalPorciones([
        { factorPorcion: '1.00', activo: true },
        { factorPorcion: '1.00', activo: false },
        { factorPorcion: '0.75' },
      ]),
    ).toBe(1.75);
  });

  it('CA-03.5 Sofía (niño, 0.5) con tres adultos suma 3.5: la etiqueta no cambia el cálculo', () => {
    const conEtiqueta = [
      { factorPorcion: 1, tipo: 'ADULTO' },
      { factorPorcion: 1, tipo: 'ADULTO' },
      { factorPorcion: 1, tipo: 'ADULTO' },
      { factorPorcion: '0.50', tipo: 'NINO' },
    ];
    expect(totalPorciones(conEtiqueta)).toBe(3.5);
    expect(totalPorciones(conEtiqueta.map((c) => ({ ...c, tipo: 'ADULTO' })))).toBe(3.5);
  });

  it('suma en cuartos exactos (sin error de punto flotante) y una lista vacía da 0', () => {
    const muchos = Array.from({ length: 10 }, () => ({ factorPorcion: '0.25' }));
    expect(totalPorciones(muchos)).toBe(2.5);
    expect(totalPorciones([])).toBe(0);
  });
});

describe('esFactorPorcionValido (CU-01.3 E3)', () => {
  it.each([0.25, 0.5, 1, 1.75, 2, '0.25', '1.00', ' 2.0 ', '1'])('acepta %p', (valor) => {
    expect(esFactorPorcionValido(valor)).toBe(true);
  });

  it.each([0, 2.25, 0.3, '0', '2.25', '0.3', -1, 0.2, 'abc', '', '1e0', null, undefined, NaN, {}])(
    'CA-03.6 rechaza %p',
    (valor) => {
      expect(esFactorPorcionValido(valor)).toBe(false);
    },
  );

  it('el mensaje es el del criterio CA-03.6', () => {
    expect(MENSAJES_COMENSALES.factorInvalido).toBe(
      'El factor debe estar entre 0.25 y 2.0 en pasos de 0.25',
    );
  });
});

describe('leerFactorPorcion', () => {
  it('lee números y textos decimales; lo demás es null', () => {
    expect(leerFactorPorcion(0.5)).toBe(0.5);
    expect(leerFactorPorcion('1.25')).toBe(1.25);
    expect(leerFactorPorcion(Infinity)).toBeNull();
    expect(leerFactorPorcion('1,5')).toBeNull();
    expect(leerFactorPorcion(true)).toBeNull();
  });
});

describe('formato del factor', () => {
  it('formatearFactor deja 2 decimales como la columna decimal(3,2)', () => {
    expect(formatearFactor(0.5)).toBe('0.50');
    expect(formatearFactor('1')).toBe('1.00');
    expect(formatearFactor(4)).toBe('4.00');
  });

  it('mostrarFactor usa al menos un decimal', () => {
    expect(mostrarFactor('1.00')).toBe('1.0');
    expect(mostrarFactor('0.50')).toBe('0.5');
    expect(mostrarFactor(0.25)).toBe('0.25');
    expect(mostrarFactor(3.5)).toBe('3.5');
  });

  it('pasoFactor sube y baja 0.25 sin salir de 0.25–2.0', () => {
    expect(pasoFactor('1.00', 1)).toBe(1.25);
    expect(pasoFactor(1, -1)).toBe(0.75);
    expect(pasoFactor(2, 1)).toBe(2);
    expect(pasoFactor('0.25', -1)).toBe(0.25);
  });
});

describe('nombres de comensales (CU-01.3 E1)', () => {
  it('limpia espacios', () => {
    expect(limpiarNombreComensal('  Abuela   Carmen ')).toBe('Abuela Carmen');
  });

  it('CA-03.3 "Ana", " ana " y "ANA" son el mismo nombre; las tildes no cuentan', () => {
    expect(normalizarNombreComensal(' ANA ')).toBe(normalizarNombreComensal('Ana'));
    expect(normalizarNombreComensal('Sofía')).toBe('sofia');
  });
});
